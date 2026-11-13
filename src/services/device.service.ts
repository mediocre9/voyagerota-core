import * as crypto from "node:crypto";
import { isPlaceholderChangelog, stagingGate } from "@utils/staging.gate";
import { redis } from "@config/redis.connection.config";
import * as ProjectDAL from "@dal/project.dal";
import * as DeviceDAL from "@dal/project.device.dal";
import * as ReportDAL from "@dal/device.report.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { DeviceReportDTO } from "@models/device.report.model";
import { Project } from "@models/project.model";
import {
  DeviceChannel,
  DeviceStatus,
  ProjectDevice,
  ProjectDeviceDTO,
} from "@models/project.device.model";
import { DeviceCreateDTO, DeviceRegisterDTO, DeviceReportDTOInput } from "@schemas/device.schema";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import { StatusCodes } from "http-status-codes";
import { container, injectable } from "tsyringe";
import { db } from "@config/db.config";
import { Release } from "@models/release.model";
import { ArtifactReleaseService } from "./release.service";
import * as PlanService from "./plan.service";
import { getFailureAlertTemplate, IEmailContentData } from "@config/email.client";
import { EmailQueue } from "@queues/email.queue";

const alertQueue = new EmailQueue<IEmailContentData>();

export const DEVICE_TOKEN_PREFIX = "vdt_";
const TOKEN_CACHE_TTL = 5 * 60; // seconds....
const LAST_SEEN_THROTTLE = 60; // seconds....

export type AuthenticatedDevice = { id: number; projectId: number };

export type RegistrationResult =
  | { status: "pending"; device: ProjectDeviceDTO }
  | { status: "active"; device: ProjectDeviceDTO; token: string };

export type DeviceWithLastReport = ProjectDeviceDTO & { lastReport: DeviceReportDTO | null };

export type ReleaseRollout = { updated: number; failed: number; running: number; alert: boolean };

export const HISTORY_LIMIT = 10;

export type RolloutSettings = {
  failureAlertCount: number;
  failureAlertPercent: number;
  autoRevoke: boolean;
};

export function rolloutSettings(project: Project): RolloutSettings {
  return {
    failureAlertCount: project.failure_alert_count ?? 3,
    failureAlertPercent: project.failure_alert_percent ?? 20,
    autoRevoke: Boolean(project.auto_revoke),
  };
}

// a release is flagged once its failures reach the project's count or percentage threshold....
export function isOverFailureThreshold(
  settings: RolloutSettings,
  updated: number,
  failed: number,
): boolean {
  if (failed === 0) return false;
  if (failed >= settings.failureAlertCount) return true;
  return (failed * 100) / (failed + updated) >= settings.failureAlertPercent;
}

export type ReleaseDeviceRow = {
  device: ProjectDeviceDTO;
  outcome: {
    status: "success" | "failed";
    errorCode: number | null;
    message: string | null;
    at: Date;
  } | null;
  runningThisRelease: boolean;
};

export type PromotionPreflight = {
  staging: { updated: number; failed: number };
  gatePassed: boolean;
  productionDevices: number;
  changelogEmpty: boolean;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isSameHash(a: string, b: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function tokenCacheKey(tokenHash: string): string {
  return `vygr:device:token:${tokenHash}`;
}

function defaultDeviceName(hardwareId: string, chipModel?: string): string {
  const prefix = (chipModel ?? "device").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${prefix}-${hardwareId.slice(-6).toLowerCase()}`.slice(0, 64);
}

@injectable()
export class DeviceService {
  // device api.... unknown devices land as pending, active ones get a fresh token....
  public async register(project: Project, dto: DeviceRegisterDTO): Promise<RegistrationResult> {
    const claimSecretHash = sha256(dto.claimSecret);
    let device = await DeviceDAL.findByHardwareId(project.getId(), dto.hardwareId);

    if (!device) {
      // waiting devices are capped per project so a flood of fake ids can't fill the table....
      if (!(await PlanService.canQueueWaitingDevice(project))) {
        throw new ApiError(
          "Too many devices are waiting for approval in this project!",
          StatusCodes.TOO_MANY_REQUESTS,
        );
      }
      device = await DeviceDAL.create({
        projectId: project.getId(),
        hardwareId: dto.hardwareId,
        name: defaultDeviceName(dto.hardwareId, dto.chipModel),
        status: "pending",
        claimSecretHash,
        chipModel: dto.chipModel,
        firmwareVersion: dto.firmwareVersion,
      });
      Logger.info(`Device ${dto.hardwareId} requested access to project ${project.getPublicId()}`);
      return { status: "pending", device: device.toDTO() };
    }

    // devices added from the dashboard are bound to the first secret that claims them....
    if (!device.claim_secret_hash) {
      device.claim_secret_hash = claimSecretHash;
    } else if (!isSameHash(device.claim_secret_hash, claimSecretHash)) {
      throw new ApiError(
        "This hardware id is already claimed by another device!",
        StatusCodes.CONFLICT,
      );
    }

    if (dto.chipModel) device.chip_model = dto.chipModel;
    if (dto.firmwareVersion) device.firmware_version = dto.firmwareVersion;
    device.last_seen_at = new Date();

    if (device.isRevoked()) {
      await device.save();
      throw new ApiError("This device has been revoked!", StatusCodes.FORBIDDEN);
    }

    if (device.isPending()) {
      await device.save();
      return { status: "pending", device: device.toDTO() };
    }

    const token = DEVICE_TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
    await this._forgetToken(device);
    device.token_hash = sha256(token);
    await device.save();
    return { status: "active", device: device.toDTO(), token };
  }

  public async authenticate(token: string): Promise<AuthenticatedDevice | null> {
    if (!token.startsWith(DEVICE_TOKEN_PREFIX)) return null;
    const tokenHash = sha256(token);

    const cached = await redis.get(tokenCacheKey(tokenHash));
    if (cached) return JSON.parse(cached) as AuthenticatedDevice;

    const device = await DeviceDAL.findByTokenHash(tokenHash);
    if (!device || !device.isActive()) return null;

    const identity: AuthenticatedDevice = { id: device.id, projectId: device.project_id_fk };
    await redis.set(tokenCacheKey(tokenHash), JSON.stringify(identity), "EX", TOKEN_CACHE_TTL);
    return identity;
  }

  // last seen / firmware version are written at most once a minute per device....
  public async touch(
    device: AuthenticatedDevice,
    data: { firmwareVersion?: string; channel?: DeviceChannel },
  ): Promise<void> {
    const key = `vygr:device:seen:${device.id}${data.channel ? `:${data.channel}` : ""}`;
    const isFirstInWindow = await redis.set(key, "1", "EX", LAST_SEEN_THROTTLE, "NX");
    if (isFirstInWindow === "OK") {
      await DeviceDAL.touch(device.id, data);
      // a device checking in keeps its project out of the dormant cleanup, once an hour per project....
      const projectKey = `vygr:project:active:${device.projectId}`;
      if ((await redis.set(projectKey, "1", "EX", 3600, "NX")) === "OK") {
        await ProjectDAL.clearDormantSchedule(device.projectId);
      }
    }
  }

  public async report(
    device: AuthenticatedDevice,
    project: Project,
    dto: DeviceReportDTOInput,
  ): Promise<void> {
    let releaseId: number | null = null;
    if (dto.releaseId) {
      const release = await ReleaseDAL.findReleaseByPublicId(dto.releaseId);
      if (release && release.getProjectForeignKeyId() === project.getId()) {
        releaseId = release.getId();
      }
    }

    const plan = await PlanService.getProjectPlan(project);

    // report, history cap and the per release outcome are saved together....
    await db.transaction(async (transaction) => {
      await ReportDAL.create(
        {
          deviceId: device.id,
          releaseId,
          status: dto.status,
          fromVersion: dto.fromVersion,
          toVersion: dto.toVersion,
          errorCode: dto.errorCode,
          message: dto.message,
        },
        transaction,
      );
      await ReportDAL.pruneHistory(device.id, plan.limits.historyPerDevice, transaction);
      if (releaseId) {
        await ReportDAL.upsertOutcome(
          {
            deviceId: device.id,
            releaseId,
            status: dto.status,
            errorCode: dto.errorCode,
            message: dto.message,
          },
          transaction,
        );
      }
    });

    await DeviceDAL.touch(device.id, {
      firmwareVersion: dto.status === "success" ? dto.toVersion : dto.fromVersion,
    });

    if (releaseId && dto.status === "failed") {
      await this._guardProductionRelease(project, releaseId);
    }

    Logger.info(
      `Device #${device.id} reported ${dto.status} for v${dto.toVersion}${dto.message ? `: ${dto.message}` : ""}`,
    );
  }

  // dashboard api....
  public async list(project: Project, status?: DeviceStatus): Promise<DeviceWithLastReport[]> {
    const devices = await DeviceDAL.findAllByProject(project.getId(), status);
    const latest = await ReportDAL.findLatestByDevices(devices.map((d) => d.id));
    return devices.map((device) => ({
      ...device.toDTO(),
      lastReport: latest.get(device.id)?.toDTO() ?? null,
    }));
  }

  public async add(project: Project, dto: DeviceCreateDTO): Promise<ProjectDeviceDTO> {
    await PlanService.assertCanPreAddDevice(project);

    const existing = await DeviceDAL.findByHardwareId(project.getId(), dto.hardwareId);
    if (existing) {
      throw new ApiError(
        `Device ${dto.hardwareId} is already in this project (${existing.status})!`,
        StatusCodes.CONFLICT,
      );
    }

    const device = await DeviceDAL.create({
      projectId: project.getId(),
      hardwareId: dto.hardwareId,
      name: dto.name ?? defaultDeviceName(dto.hardwareId),
      status: "active",
    });
    return device.toDTO();
  }

  public async findOrFail(project: Project, deviceId: string): Promise<ProjectDevice> {
    const device = await DeviceDAL.findByPublicId(project.getId(), deviceId);
    if (!device) throw new ApiError("Device not found!", StatusCodes.NOT_FOUND);
    return device;
  }

  public async rename(device: ProjectDevice, name: string): Promise<ProjectDeviceDTO> {
    device.name = name;
    await device.save();
    return device.toDTO();
  }

  public async approve(device: ProjectDevice, project?: Project): Promise<ProjectDeviceDTO> {
    if (device.isActive()) {
      throw new ApiError("Device is already approved!", StatusCodes.CONFLICT);
    }
    if (project) await PlanService.assertCanApproveDevice(project);
    device.status = "active";
    device.approved_at = new Date();
    await device.save();
    return device.toDTO();
  }

  public async revoke(device: ProjectDevice): Promise<ProjectDeviceDTO> {
    if (device.isRevoked()) {
      throw new ApiError("Device is already revoked!", StatusCodes.CONFLICT);
    }
    await this._forgetToken(device);
    device.status = "revoked";
    device.token_hash = null;
    await device.save();
    return device.toDTO();
  }

  public async remove(device: ProjectDevice): Promise<void> {
    await this._forgetToken(device);
    await device.destroy();
  }

  public async reports(device: ProjectDevice): Promise<DeviceReportDTO[]> {
    const reports = await ReportDAL.findByDevice(device.id);
    return reports.map((r) => r.toDTO());
  }

  public async rollout(project: Project): Promise<Record<string, ReleaseRollout>> {
    const [releases, rows, devices] = await Promise.all([
      ReleaseDAL.findReleasesByProjectId(project.getId()),
      ReportDAL.getRollout(project.getId()),
      DeviceDAL.findAllByProject(project.getId(), "active"),
    ]);

    const settings = rolloutSettings(project);
    const byRelease = new Map(rows.map((row) => [Number(row.release_id_fk), row]));
    const result: Record<string, ReleaseRollout> = {};
    for (const release of releases) {
      const row = byRelease.get(release.getId());
      const updated = Number(row?.updated ?? 0);
      const failed = Number(row?.failed ?? 0);
      result[release.getPublicId()] = {
        updated,
        failed,
        running: devices.filter((d) => d.firmware_version === release.getVersion()).length,
        alert: release.isProduction() && isOverFailureThreshold(settings, updated, failed),
      };
    }
    return result;
  }

  // every active device with its result for this release....
  public async releaseDevices(project: Project, release: Release): Promise<ReleaseDeviceRow[]> {
    const [devices, outcomes] = await Promise.all([
      DeviceDAL.findAllByProject(project.getId(), "active"),
      ReportDAL.findOutcomesByRelease(release.getId()),
    ]);
    const byDevice = new Map(outcomes.map((o) => [o.device_id_fk, o]));
    return devices
      .map((device) => {
        const outcome = byDevice.get(device.id);
        return {
          device: device.toDTO(),
          outcome: outcome
            ? {
                status: outcome.status,
                errorCode: outcome.error_code,
                message: outcome.message,
                at: outcome.updated_at,
              }
            : null,
          runningThisRelease: device.firmware_version === release.getVersion(),
        };
      })
      .sort((a, b) => Number(Boolean(b.outcome)) - Number(Boolean(a.outcome)));
  }

  public async preflight(project: Project, release: Release): Promise<PromotionPreflight> {
    const [rows, devices] = await Promise.all([
      ReportDAL.getRollout(project.getId(), release.getId()),
      DeviceDAL.findAllByProject(project.getId(), "active"),
    ]);

    const updated = Number(rows[0]?.updated ?? 0);
    const failed = Number(rows[0]?.failed ?? 0);
    return {
      staging: { updated, failed },
      gatePassed: stagingGate(updated).passed,
      productionDevices: devices.filter((d) => d.channel !== "staging").length,
      changelogEmpty: isPlaceholderChangelog(release.getChangeLog()),
    };
  }

  // after a failed report on the latest production release: alert, and auto revoke if the project wants it....
  private async _guardProductionRelease(project: Project, releaseId: number): Promise<void> {
    const settings = rolloutSettings(project);

    const latest = await ReleaseDAL.getLatestProductionRelease(project.getId());
    if (!latest || latest.getId() !== releaseId) return;

    const [row] = await ReportDAL.getRollout(project.getId(), releaseId);
    const updated = Number(row?.updated ?? 0);
    const failed = Number(row?.failed ?? 0);
    if (!isOverFailureThreshold(settings, updated, failed)) return;

    const owner = await PlanService.getProjectOwner(project);
    const plan = PlanService.getAccountPlan(owner);
    const willRevoke = settings.autoRevoke && plan.limits.autoRevoke;

    if (plan.limits.emailAlerts) {
      await this._sendFailureAlert(owner.getEmail(), project, latest, {
        updated,
        failed,
        willRevoke,
      });
    }

    if (!willRevoke) return;

    const withArtifact = await ReleaseDAL.findReleaseWithArtifact(latest.getPublicId());
    const artifactId = withArtifact?.Artifacts?.[0]?.public_id;
    if (!artifactId) return;

    try {
      await container
        .resolve(ArtifactReleaseService)
        .revoke({ releaseId: latest.getPublicId(), artifactId });
      Logger.warn(
        `Auto revoked v${latest.getVersion()} of project ${project.getPublicId()}: failure threshold reached`,
      );
    } catch (error) {
      Logger.error(`Auto revoke failed: ${(error as Error).message}`);
    }
  }

  // once per release, the job id keeps a burst of failed reports from sending it twice....
  private async _sendFailureAlert(
    email: string,
    project: Project,
    release: Release,
    counts: { updated: number; failed: number; willRevoke: boolean },
  ): Promise<void> {
    const key = `vygr:alert:release:${release.getId()}`;
    if ((await redis.set(key, "1", "EX", 90 * 24 * 60 * 60, "NX")) !== "OK") return;

    try {
      await alertQueue.enqueueEmail(
        {
          subject: `${project.getProjectName()} v${release.getVersion()} is failing on devices`,
          recipientEmail: email,
          body: getFailureAlertTemplate({
            projectName: project.getProjectName(),
            version: release.getVersion(),
            ...counts,
          }),
        },
        `failure-alert-${release.getId()}`,
      );
    } catch (error) {
      await redis.del(key);
      Logger.error(`Failure alert email not queued: ${(error as Error).message}`);
    }
  }

  private async _forgetToken(device: ProjectDevice): Promise<void> {
    if (device.token_hash) {
      await redis.del(tokenCacheKey(device.token_hash));
    }
  }
}
