import { Release } from "@models/release";
import { Op } from "sequelize";
import { Nullable } from "types";

export async function createRelease(
  projectId: string,
  version: string,
  flattenedVersion: number,
  hash?: string,
  changelog?: string,
): Promise<void> {
  await Release.create({
    project_id_fk: projectId,
    version: version,
    flatten_version: flattenedVersion,
    change_log: changelog,
    firmware_hash: hash,
  });
}

export async function hasHashSignatureViolation(
  hash: string,
): Promise<Readonly<Nullable<Release>>> {
  return await Release.findOne({
    attributes: { include: ["version"] },
    where: {
      firmware_hash: {
        [Op.eq]: hash,
      },
    },
  });
}

export async function findEqualOrOlderVersions(
  version: number,
): Promise<Nullable<Release>> {
  const found = await Release.findOne({
    where: {
      flatten_version: {
        [Op.gte]: version,
      },
    },
    order: [["flatten_version", "DESC"]],
  });
  return found;
}

export async function getReleases(id: string): Promise<Readonly<Release[]>> {
  return await Release.findAll({
    where: { project_id_fk: id },
    order: [["flatten_version", "DESC"]],
  });
}
