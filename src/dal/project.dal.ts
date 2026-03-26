import { Project } from "@models/project.model";
import { generateApiKey } from "@utils/utils";
import sequelize, { Transaction } from "sequelize";
import { Op } from "sequelize";
import { Nullable } from "@interfaces/common/common";
import { Release } from "@models/release.model";
import { Artifact } from "@models/artifact.model";

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

export async function findProjectByApiKey(apiKey: string): Promise<Readonly<Nullable<Project>>> {
  return await Project.findOne({
    where: { api_key: apiKey },
  });
}

export async function findProjectByInternalId(id: number): Promise<Readonly<Nullable<Project>>> {
  return await Project.findOne({
    where: { id: id },
  });
}

export async function deleteProject(
  projectId: number,
  transactionObject?: Transaction,
): Promise<void> {
  await Project.destroy({
    where: { id: projectId },
    transaction: transactionObject,
    force: false,
  });
}

export async function purgeAllProjects(date: Date, transactionObject?: Transaction): Promise<void> {
  await Project.destroy({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    transaction: transactionObject,
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
