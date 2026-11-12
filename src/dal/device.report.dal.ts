import { db } from "@config/db.config";
import { DeviceReleaseOutcome } from "@models/device.outcome.model";
import { DeviceReportStatus, DeviceUpdateReport } from "@models/device.report.model";
import { Release } from "@models/release.model";
import { Op, QueryTypes, Transaction } from "sequelize";

export async function create(
  data: {
    deviceId: number;
    releaseId: number | null;
    status: DeviceReportStatus;
    fromVersion?: string | null;
    toVersion: string;
    errorCode?: number | null;
    message?: string | null;
  },
  transaction?: Transaction,
): Promise<DeviceUpdateReport> {
  return await DeviceUpdateReport.create(
    {
      device_id_fk: data.deviceId,
      release_id_fk: data.releaseId,
      status: data.status,
      from_version: data.fromVersion ?? null,
      to_version: data.toVersion,
      error_code: data.errorCode ?? null,
      message: data.message ?? null,
    },
    { transaction },
  );
}

// keep only the newest `keep` reports of a device....
export async function pruneHistory(
  deviceId: number,
  keep: number,
  transaction?: Transaction,
): Promise<number> {
  const newest = await DeviceUpdateReport.findAll({
    where: { device_id_fk: deviceId },
    attributes: ["id"],
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
    limit: keep,
    transaction,
  });
  if (newest.length < keep) return 0;
  return await DeviceUpdateReport.destroy({
    where: { device_id_fk: deviceId, id: { [Op.notIn]: newest.map((r) => r.id) } },
    transaction,
  });
}

export async function upsertOutcome(
  data: {
    deviceId: number;
    releaseId: number;
    status: DeviceReportStatus;
    errorCode?: number | null;
    message?: string | null;
  },
  transaction?: Transaction,
): Promise<void> {
  await DeviceReleaseOutcome.upsert(
    {
      device_id_fk: data.deviceId,
      release_id_fk: data.releaseId,
      status: data.status,
      error_code: data.errorCode ?? null,
      message: data.message ?? null,
    },
    { transaction },
  );
}

export async function findOutcomesByRelease(
  releaseId: number,
): Promise<readonly DeviceReleaseOutcome[]> {
  return await DeviceReleaseOutcome.findAll({
    where: { release_id_fk: releaseId },
    order: [["updated_at", "DESC"]],
  });
}

export async function findByDevice(
  deviceId: number,
  limit = 50,
): Promise<readonly DeviceUpdateReport[]> {
  return await DeviceUpdateReport.findAll({
    where: { device_id_fk: deviceId },
    include: [{ model: Release, attributes: ["public_id"], paranoid: false }],
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
    limit,
  });
}

export async function findLatestByDevices(
  deviceIds: readonly number[],
): Promise<Map<number, DeviceUpdateReport>> {
  const latest = new Map<number, DeviceUpdateReport>();
  if (deviceIds.length === 0) return latest;

  const reports = await DeviceUpdateReport.findAll({
    where: { device_id_fk: deviceIds as number[] },
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
  });
  for (const report of reports) {
    if (!latest.has(report.device_id_fk)) latest.set(report.device_id_fk, report);
  }
  return latest;
}

export type RolloutRow = { release_id_fk: number; updated: number; failed: number };

// per release: devices whose latest result for it is success / failed....
export async function getRollout(
  projectId: number,
  releaseId?: number,
): Promise<readonly RolloutRow[]> {
  return await db.query<RolloutRow>(
    `SELECT o.release_id_fk,
            SUM(o.status = 'success') AS updated,
            SUM(o.status = 'failed') AS failed
     FROM device_release_outcomes o
     JOIN project_devices d ON d.id = o.device_id_fk
     WHERE d.project_id_fk = :projectId ${releaseId ? "AND o.release_id_fk = :releaseId" : ""}
     GROUP BY o.release_id_fk`,
    { type: QueryTypes.SELECT, replacements: { projectId, releaseId } },
  );
}
