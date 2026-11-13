import { DormantNotice, Project } from "@models/project.model";
import { generateApiKey } from "@utils/utils";
import sequelize, { Sequelize, Transaction } from "sequelize";
import { Op } from "sequelize";
import { Nullable } from "../types";
import { Release } from "@models/release.model";
import { Artifact } from "@models/artifact.model";
import { User } from "@models/index";

export type ProjectData = {
  userId: number;
  name: string;
  boardType: "ESP32" | "ESP8266";
};

interface ArtifactAttributes {
  public_id: string;
  hash: string;
}

interface ReleaseAttributes {
  public_id: string;
  version: string;
  channel: string;
  ArtifactFiles?: ArtifactAttributes[];
}

interface ProjectAttributes {
  public_id: string;
  project_name: string;
  board_type: string;
  Releases?: ReleaseAttributes[];
}
export async function isHashFoundAcrossReleases(
  projectId: number,
  hash: string,
): Promise<Nullable<ProjectAttributes>> {
  const found = await Project.findOne({
    where: { id: projectId },
    attributes: ["public_id", "project_name", "board_type"],
    include: [
      {
        model: Release,
        attributes: ["public_id", "version", "channel"],
        required: true,
        include: [
          {
            model: Artifact,
            attributes: ["public_id", "hash"],
            required: true,
            where: { hash: hash },
          },
        ],
      },
    ],
  });

  return found as ProjectAttributes;
}

export async function createProject(data: ProjectData): Promise<Project> {
  const { userId, name, boardType } = data;

  return await Project.create({
    user_id_fk: userId,
    project_name: name,
    board_type: boardType,
  });
}

export async function rotateProjectApiKey(projectId: string): Promise<void> {
  const apiKey = generateApiKey();
  await Project.update({ api_key: apiKey }, { where: { public_id: projectId } });
}

export async function isProjectNameInUse(
  userId: number,
  name: string,
): Promise<Readonly<Nullable<Project>>> {
  return await Project.findOne({
    attributes: { exclude: ["id"] },
    where: { user_id_fk: userId, project_name: name },
  });
}

export async function findProjectsByUserId(userId: number): Promise<readonly Project[]> {
  return await Project.findAll({
    include: [{ model: Release, as: "Releases" }],
    order: [[sequelize.col("flatten_version"), "DESC"]],
    where: { user_id_fk: userId },
  });
}

export async function findProjectByPublicId(
  publicID: string,
): Promise<Readonly<Nullable<Project>>> {
  return await Project.findOne({
    where: { public_id: publicID },
  });
}

export async function findProjectByPublicIdAndApiKey(
  publicID: string,
  apiKey: string,
): Promise<Readonly<Nullable<Project>>> {
  return await Project.findOne({
    where: { public_id: publicID, api_key: apiKey },
  });
}

export async function findProjectByApiKey(apiKey: string): Promise<Nullable<Project>> {
  return await Project.findOne({
    where: { api_key: apiKey },
  });
}

export async function findProjectByInternalId(id: number): Promise<Nullable<Project>> {
  return await Project.findOne({
    where: { id: id },
  });
}
export async function findAllProjectsByInternalId(id: number): Promise<readonly Project[]> {
  return await Project.findAll({
    where: { id: id },
  });
}
export async function findAllSoftDeletedProjectByInternalId(
  id: number,
): Promise<readonly Project[]> {
  return await Project.findAll({
    where: { id: id },
    paranoid: false,
  });
}
export async function findSoftDeletedProjectById(id: string): Promise<Nullable<Project>> {
  return await Project.findOne({
    where: { public_id: id },
    paranoid: false,
  });
}

export async function softDeleteProject(
  projectId: number,
  transactionObject?: Transaction,
): Promise<void> {
  await Project.destroy({
    where: { id: projectId },
    transaction: transactionObject,
    force: false,
  });
}

export async function purgeAllProjects(date: Date, transaction?: Transaction): Promise<number> {
  return await Project.destroy({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    transaction: transaction,
    force: true,
  });
}

export async function getSoftDeletedProjects(date: Date): Promise<readonly Project[]> {
  return await Project.findAll({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    paranoid: false,
  });
}

export async function findDormantProjects(limit: number, date: Date): Promise<readonly Project[]> {
  return await Project.findAll({
    include: [
      { model: Release, as: "Releases" },
      { model: User, as: "User" },
    ],
    where: {
      last_activity: {
        [Op.lte]: date,
      },
      is_suspended: false,
    },
    order: [[sequelize.col("last_activity"), "ASC"]],
    limit: limit,
  });
}

export async function purgeDormantProjects(date: Date, transaction?: Transaction): Promise<number> {
  return await Project.destroy({
    where: {
      last_activity: {
        [Op.lte]: date,
      },
      is_suspended: true,
    },
    transaction: transaction,
    force: true,
  });
}

export async function updateProjectSuspendStatus(
  projectId: number,
  status: boolean,
  transaction?: Transaction,
): Promise<void> {
  await Project.update(
    {
      is_suspended: status,
    },
    {
      where: {
        id: projectId,
      },
      transaction: transaction,
    },
  );
}

export async function updateRolloutSettings(
  projectId: number,
  settings: { failure_alert_count?: number; failure_alert_percent?: number; auto_revoke?: boolean },
): Promise<void> {
  const values = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined));
  await Project.update(values, { where: { id: projectId } });
}

export async function findIdleProjects(limit: number, date: Date): Promise<readonly Project[]> {
  return await Project.findAll({
    include: [
      { model: Release, as: "Releases" },
      { model: User, as: "User" },
    ],
    where: {
      last_activity: {
        [Op.lte]: date,
      },
    },
    order: [
      [sequelize.col("last_activity"), "ASC"],
      [{ model: Release, as: "Releases" }, "id", "ASC"],
    ],
    limit: limit,
  });
}

export async function scheduleDormantDeletion(
  projectId: number,
  notice: DormantNotice,
  scheduledAt: Date,
): Promise<void> {
  await Project.update(
    { dormant_notice: notice, deletion_scheduled_at: scheduledAt, is_suspended: true },
    { where: { id: projectId } },
  );
}

export async function clearDormantSchedule(projectId: number): Promise<void> {
  await Project.update(
    {
      last_activity: new Date(),
      is_suspended: false,
      dormant_notice: null,
      deletion_scheduled_at: null,
    },
    { where: { id: projectId } },
  );
}

// only after the final notice went out, so nobody is deleted without being told....
export async function findProjectsDueForDeletion(
  date: Date,
  limit: number,
): Promise<readonly Project[]> {
  return await Project.findAll({
    include: [{ model: User, as: "User" }],
    where: {
      deletion_scheduled_at: { [Op.lte]: date },
      dormant_notice: "final",
    },
    limit: limit,
  });
}
