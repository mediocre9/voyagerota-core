import { Release, ReleaseChannel } from "@models/release.model";
import { Op } from "sequelize";
import { Transaction } from "sequelize";
import sequelize from "sequelize";
import { Artifact } from "@models/artifact.model";
import { Nullable } from "../types";

export async function createRelease(
  projectId: number,
  version: string,
  flattenedVersion: number,
  changelog?: string,
  transactionObject?: Transaction,
): Promise<Release> {
  return await Release.create(
    {
      project_id_fk: projectId,
      version: version,
      flatten_version: flattenedVersion,
      change_log: changelog,
    },
    { transaction: transactionObject, isNewRecord: true },
  );
}

export async function hasVersionCollision(
  projectId: number,
  version: number,
): Promise<Nullable<Release>> {
  const found = await Release.findOne({
    where: {
      project_id_fk: projectId,
      flatten_version: {
        [Op.gte]: version,
      },
    },
    order: [["flatten_version", "DESC"]],
  });
  return found;
}

export async function hashCollision(releaseId: string, hash: string) {
  const found = await Release.findAll({
    where: { public_id: releaseId },
    include: [{ model: Artifact, required: true, where: { hash: hash } }],
  });
  return found;
}

export async function updateReleaseChannel(
  releaseId: string,
  channel: ReleaseChannel,
  transaction?: Transaction,
): Promise<void> {
  // remember when each stage was reached, for the release timeline....
  const stamps =
    channel === "staging"
      ? { staged_at: new Date() }
      : channel === "revoked"
        ? { revoked_at: new Date() }
        : channel === "draft"
          ? { staged_at: null }
          : {};
  await Release.update(
    { channel: channel, ...stamps },
    {
      where: {
        public_id: releaseId,
      },
      individualHooks: true,
      transaction: transaction,
    },
  );
}

export async function setProductionReleaseDate(
  releaseId: string,
  transaction?: Transaction,
): Promise<void> {
  await Release.update(
    { released_at: new Date() },
    {
      where: {
        [Op.and]: [{ public_id: releaseId }, { channel: "production" }],
      },
      transaction: transaction,
      individualHooks: true,
    },
  );
}

export async function getAllReleases(
  projectId: number,
  channel?: ReleaseChannel | "all",
  limit?: number,
  offset?: number,
): Promise<readonly Release[]> {
  if (channel === "all") {
    const releases = await Release.findAll({
      limit: limit,
      offset: offset,
      where: { project_id_fk: projectId },
      order: [["flatten_version", "DESC"]],
      include: [
        {
          model: Artifact,
          attributes: ["public_id", "hash", "original_filename", "filename", "size"],
        },
      ],
    });

    return releases;
  }

  const releases = await Release.findAll({
    limit: limit,
    offset: offset,
    where: { project_id_fk: projectId, channel: channel },
    include: [
      {
        model: Artifact,
        attributes: ["public_id", "hash", "filename", "size"],
      },
    ],
    order: [["flatten_version", "DESC"]],
  });

  return releases;
}

export async function softDeleteAllReleases(
  projectId: number,
  transactionObject?: Transaction,
): Promise<void> {
  await Release.destroy({
    where: { project_id_fk: projectId },
    transaction: transactionObject,
    force: false,
  });
}

export async function getSoftDeletedReleases(date: Date): Promise<readonly Release[]> {
  return await Release.findAll({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    paranoid: false,
  });
}

export async function purgeAllReleases(date: Date, transactionObject?: Transaction): Promise<void> {
  await Release.destroy({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    transaction: transactionObject,
    force: true,
  });
}

export async function deleteReleaseByPublicId(
  publicId: string,
  transaction?: Transaction,
): Promise<void> {
  await Release.destroy({
    where: { public_id: publicId },
    transaction: transaction,
    force: true,
  });
}

export async function findReleaseByPublicId(publicId: string): Promise<Nullable<Release>> {
  const release = await Release.findOne({
    where: { public_id: publicId },
  });

  return release;
}

export async function findReleasesByProjectId(projectId: number): Promise<readonly Release[]> {
  const releases = await Release.findAll({
    where: { project_id_fk: projectId },
  });

  return releases;
}

export async function findSoftDeletedReleasesByProjectId(
  projectId: number,
): Promise<readonly Release[]> {
  const releases = await Release.findAll({
    where: { project_id_fk: projectId },
    paranoid: false,
  });

  return releases;
}

export async function findSoftDeletedReleaseByPublicId(
  publicId: string,
): Promise<Nullable<Release>> {
  const release = await Release.findOne({
    where: { public_id: publicId },
    paranoid: false,
  });

  return release;
}

export async function findSoftDeletedReleaseById(id: number): Promise<Nullable<Release>> {
  const release = await Release.findOne({
    where: { id: id },
    paranoid: false,
  });

  return release;
}

export async function findReleaseByVersion(version: string): Promise<Nullable<Release>> {
  const release = await Release.findOne({
    where: { version: version },
  });

  return release;
}

export async function getLatestReleaseByProjectId(
  projectId: number,
  channel: ReleaseChannel,
): Promise<Nullable<Release>> {
  const release = await Release.findOne({
    where: {
      project_id_fk: projectId,
      channel: channel,
    },
    attributes: [
      "public_id",
      "version",
      "channel",
      "change_log",
      "created_at",
      "released_at",
      "flatten_version",
    ],
    include: [
      {
        model: Artifact,
        required: true,
        attributes: ["public_id", "hash", "filename", "size"],
      },
    ],
    order: [[sequelize.col("flatten_version"), "DESC"]],
  });

  return release;
}

export async function getLatestProductionRelease(projectId: number): Promise<Nullable<Release>> {
  const release = await Release.findOne({
    where: {
      project_id_fk: projectId,
      channel: "production",
    },
    order: [[sequelize.col("flatten_version"), "DESC"]],
  });

  return release;
}

export async function getReleaseById(releaseId: number): Promise<Nullable<Release>> {
  return await Release.findOne({
    where: {
      id: releaseId,
    },
    order: [[sequelize.col("flatten_version"), "DESC"]],
  });
}

export async function countReleases(
  projectId: number,
  channel: ReleaseChannel | "all",
): Promise<number> {
  return await Release.count({
    where: channel === "all" ? { project_id_fk: projectId } : { project_id_fk: projectId, channel },
  });
}

export async function findReleaseWithArtifact(publicId: string): Promise<Nullable<Release>> {
  return await Release.findOne({
    where: { public_id: publicId },
    include: [
      {
        model: Artifact,
        attributes: ["public_id", "hash", "original_filename", "filename", "size"],
      },
    ],
  });
}

export async function findProjectReleaseByVersion(
  projectId: number,
  version: string,
): Promise<Nullable<Release>> {
  return await Release.findOne({ where: { project_id_fk: projectId, version } });
}

export async function updateChangelog(releaseId: string, changelog: string): Promise<void> {
  await Release.update(
    { change_log: changelog },
    { where: { public_id: releaseId }, individualHooks: true },
  );
}
