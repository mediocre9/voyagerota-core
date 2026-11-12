import { DeviceStatus, ProjectDevice } from "@models/project.device.model";
import { Nullable } from "../types";

export async function findByHardwareId(
  projectId: number,
  hardwareId: string,
): Promise<Nullable<ProjectDevice>> {
  return await ProjectDevice.findOne({
    where: { project_id_fk: projectId, hardware_id: hardwareId },
  });
}

export async function findByPublicId(
  projectId: number,
  publicId: string,
): Promise<Nullable<ProjectDevice>> {
  return await ProjectDevice.findOne({ where: { project_id_fk: projectId, public_id: publicId } });
}

export async function findById(id: number): Promise<Nullable<ProjectDevice>> {
  return await ProjectDevice.findByPk(id);
}

export async function findByTokenHash(tokenHash: string): Promise<Nullable<ProjectDevice>> {
  return await ProjectDevice.findOne({ where: { token_hash: tokenHash } });
}

export async function findAllByProject(
  projectId: number,
  status?: DeviceStatus,
): Promise<readonly ProjectDevice[]> {
  return await ProjectDevice.findAll({
    where: status ? { project_id_fk: projectId, status } : { project_id_fk: projectId },
    order: [
      ["status", "ASC"],
      ["created_at", "DESC"],
    ],
  });
}

export async function create(data: {
  projectId: number;
  hardwareId: string;
  name: string;
  status: DeviceStatus;
  claimSecretHash?: string | null;
  chipModel?: string | null;
  firmwareVersion?: string | null;
}): Promise<ProjectDevice> {
  return await ProjectDevice.create({
    project_id_fk: data.projectId,
    hardware_id: data.hardwareId,
    name: data.name,
    status: data.status,
    claim_secret_hash: data.claimSecretHash ?? null,
    chip_model: data.chipModel ?? null,
    firmware_version: data.firmwareVersion ?? null,
    approved_at: data.status === "active" ? new Date() : null,
  });
}

export async function touch(
  deviceId: number,
  data: { firmwareVersion?: string | null; channel?: "staging" | "production" },
): Promise<void> {
  await ProjectDevice.update(
    {
      last_seen_at: new Date(),
      ...(data.firmwareVersion ? { firmware_version: data.firmwareVersion } : {}),
      ...(data.channel ? { channel: data.channel } : {}),
    },
    { where: { id: deviceId } },
  );
}
