import { DeviceStatus, ProjectDevice } from "@models/project.device.model";
import { Project } from "@models/project.model";
import { Op } from "sequelize";
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

// devices in one project: active ones seen since the date, and the ones waiting....
export async function countProjectDevices(
  projectId: number,
  activeSince: Date,
): Promise<{ active: number; waiting: number }> {
  const [active, waiting] = await Promise.all([
    ProjectDevice.count({
      where: {
        project_id_fk: projectId,
        status: "active",
        [Op.or]: [{ last_seen_at: { [Op.gte]: activeSince } }, { last_seen_at: null }],
      },
    }),
    ProjectDevice.count({ where: { project_id_fk: projectId, status: "pending" } }),
  ]);
  return { active, waiting };
}

export async function countWaitingByProject(projectId: number): Promise<number> {
  return await ProjectDevice.count({ where: { project_id_fk: projectId, status: "pending" } });
}

// the same boards in the owner's other projects, a board belongs to one project at a time....
export async function findInOtherProjects(
  userId: number,
  hardwareIds: string[],
  excludeProjectId: number,
): Promise<readonly ProjectDevice[]> {
  if (hardwareIds.length === 0) return [];
  return await ProjectDevice.findAll({
    where: { hardware_id: hardwareIds, project_id_fk: { [Op.ne]: excludeProjectId } },
    include: [
      {
        model: Project,
        attributes: ["public_id", "project_name"],
        where: { user_id_fk: userId },
        required: true,
      },
    ],
  });
}
