import * as crypto from "node:crypto";
import { redis } from "@config/redis.connection.config";
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
import { injectable } from "tsyringe";

export const DEVICE_TOKEN_PREFIX = "vdt_";
const TOKEN_CACHE_TTL = 5 * 60; // seconds....
const LAST_SEEN_THROTTLE = 60; // seconds....

export type AuthenticatedDevice = { id: number; projectId: number };

export type RegistrationResult =
  | { status: "pending"; device: ProjectDeviceDTO }
  | { status: "active"; device: ProjectDeviceDTO; token: string };

export type DeviceWithLastReport = ProjectDeviceDTO & { lastReport: DeviceReportDTO | null };

export type ReleaseRollout = { updated: number; failed: number; running: number };

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

    await ReportDAL.create({
      deviceId: device.id,
      releaseId,
      status: dto.status,
      fromVersion: dto.fromVersion,
      toVersion: dto.toVersion,
      errorCode: dto.errorCode,
      message: dto.message,
    });

    await DeviceDAL.touch(device.id, {
      firmwareVersion: dto.status === "success" ? dto.toVersion : dto.fromVersion,
    });

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

  public async approve(device: ProjectDevice): Promise<ProjectDeviceDTO> {
    if (device.isActive()) {
      throw new ApiError("Device is already approved!", StatusCodes.CONFLICT);
    }
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

    const byRelease = new Map(rows.map((row) => [Number(row.release_id_fk), row]));
    const result: Record<string, ReleaseRollout> = {};
    for (const release of releases) {
      const row = byRelease.get(release.getId());
      result[release.getPublicId()] = {
        updated: Number(row?.updated ?? 0),
        failed: Number(row?.failed ?? 0),
        running: devices.filter((d) => d.firmware_version === release.getVersion()).length,
      };
    }
    return result;
  }

  private async _forgetToken(device: ProjectDevice): Promise<void> {
    if (device.token_hash) {
      await redis.del(tokenCacheKey(device.token_hash));
    }
  }
}
