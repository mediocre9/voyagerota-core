import { db } from "@config/db.config";
import { DeviceReportStatus, DeviceUpdateReport } from "@models/device.report.model";
import { Release } from "@models/release.model";
import { QueryTypes } from "sequelize";

export async function create(data: {
  deviceId: number;
  releaseId: number | null;
  status: DeviceReportStatus;
  fromVersion?: string | null;
  toVersion: string;
  errorCode?: number | null;
  message?: string | null;
}): Promise<DeviceUpdateReport> {
  return await DeviceUpdateReport.create({
    device_id_fk: data.deviceId,
    release_id_fk: data.releaseId,
    status: data.status,
    from_version: data.fromVersion ?? null,
    to_version: data.toVersion,
    error_code: data.errorCode ?? null,
    message: data.message ?? null,
  });
}

export async function findByDevice(
  deviceId: number,
  limit = 50,
): Promise<readonly DeviceUpdateReport[]> {
  return await DeviceUpdateReport.findAll({
    where: { device_id_fk: deviceId },
    include: [{ model: Release, attributes: ["public_id"], paranoid: false }],
    order: [["created_at", "DESC"]],
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
    order: [["created_at", "DESC"]],
  });
  for (const report of reports) {
    if (!latest.has(report.device_id_fk)) latest.set(report.device_id_fk, report);
  }
  return latest;
}

export type RolloutRow = { release_id_fk: number; updated: number; failed: number };

// per release: devices that reported success, and devices whose last report for it failed....
export async function getRollout(projectId: number): Promise<readonly RolloutRow[]> {
  return await db.query<RolloutRow>(
    `SELECT r.release_id_fk,
            COUNT(DISTINCT CASE WHEN r.status = 'success' THEN r.device_id_fk END) AS updated,
            COUNT(DISTINCT CASE WHEN r.status = 'failed' AND NOT EXISTS (
              SELECT 1 FROM device_update_reports s
              WHERE s.device_id_fk = r.device_id_fk AND s.release_id_fk = r.release_id_fk
                AND s.status = 'success'
            ) THEN r.device_id_fk END) AS failed
     FROM device_update_reports r
     JOIN project_devices d ON d.id = r.device_id_fk
     WHERE d.project_id_fk = :projectId AND r.release_id_fk IS NOT NULL
     GROUP BY r.release_id_fk`,
    { type: QueryTypes.SELECT, replacements: { projectId } },
  );
}
