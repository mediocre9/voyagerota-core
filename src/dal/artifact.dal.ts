import { ArtifactBuildStatus, Artifact } from "@models/artifact.model";
import { Nullable } from "@interfaces/common/common";
import { Op } from "sequelize";
import { Transaction } from "sequelize";
import { Logger } from "@utils/logger";
import { log } from "console";

export async function findArtifactByFilename(filename: string): Promise<Nullable<Artifact>> {
  const found = await Artifact.findOne({
    where: { filename: filename },
  });

  return found;
}

export async function findProcessedArtifact(releaseId: number): Promise<Nullable<Artifact>> {
  const found = await Artifact.findOne({
    where: {
      [Op.and]: [{ release_id_fk: releaseId }, { state: "pending" }],
    },
  });

  return found;
}

export async function findPendingArtifact(
  releaseId: number,
  filename: string,
): Promise<Nullable<Artifact>> {
  const found = await Artifact.findOne({
    where: {
      original_filename: filename,
      release_id_fk: releaseId,
      state: "pending",
    },
  });
  return found;
}

export async function findArtifactById(id: string): Promise<Nullable<Artifact>> {
  const found = await Artifact.findOne({
    where: { public_id: id },
  });

  return found;
}

export async function findArtifactByInternalId(id: number): Promise<Nullable<Artifact>> {
  const found = await Artifact.findOne({
    where: { id: id },
  });

  return found;
}

export async function findArtifact(
  releaseId: number,
  filename: string,
): Promise<Nullable<Artifact>> {
  const found = await Artifact.findOne({
    where: { release_id_fk: releaseId, original_filename: filename },
  });

  return found;
}

// export async function findArtifactByReleaseId(releaseId: number): Promise<Nullable<ArtifactFile>> {
//   const found = await ArtifactFile.findOne({
//     where: { release_id_fk: releaseId },
//   });

//   return found;
// }

export async function findSoftDeletedArtifactByReleaseId(
  releaseId: number,
): Promise<Nullable<Artifact>> {
  const found = await Artifact.findOne({
    where: { release_id_fk: releaseId },
    paranoid: false,
  });

  return found;
}

export async function deleteArtifactByReleaseId(
  releaseId: number,
  transaction?: Transaction | null,
  hardDelete: boolean = false,
): Promise<void> {
  await Artifact.destroy({
    where: { release_id_fk: releaseId },
    force: hardDelete,
    transaction: transaction,
  });
}

export async function getSoftDeletedArtifacts(date: Date): Promise<readonly Artifact[]> {
  return await Artifact.findAll({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    paranoid: false,
  });
}

export async function purgeAllArtifacts(
  date: Date,
  transactionObject?: Transaction,
): Promise<void> {
  await Artifact.destroy({
    where: {
      deleted_at: {
        [Op.lte]: date,
      },
    },
    transaction: transactionObject,
    force: true,
  });
}

// TODO consider soft deletion later
export async function deleteByFilename(filename: string, transaction: Transaction): Promise<void> {
  await Artifact.destroy({
    where: { filename: filename },
    force: true,
    transaction: transaction,
  });
}
export type ArtifactUpdateOptions = {
  filename?: string;
  size?: number;
  originalFileName: string;
  hash?: string;
};

export async function createOrUpdate(
  releaseId: number,
  opts?: ArtifactUpdateOptions,
  transaction?: Transaction,
): Promise<Artifact> {
  const [artifact, _] = await Artifact.upsert(
    {
      release_id_fk: releaseId,
      filename: opts?.filename,
      size: opts?.size,
      original_filename: opts?.originalFileName,
      hash: opts?.hash,
    },
    { transaction: transaction },
  );
  return artifact;
}

export async function isHashFound(releaseId: number, hash: string) {
  return await Artifact.findOne({
    where: { release_id_fk: releaseId, hash: hash },
  });
}

export async function isArtifactAlreadySaved(releaseId: number) {
  return await Artifact.findOne({
    where: { release_id_fk: releaseId },
  });
}
// export async function updateStatus(
//   releaseId: number,
//   status: ReleaseStatus,
//   transaction?: Transaction
// ) {
//   await ArtifactFile.update(
//     { status: status },
//     { where: { release_id_fk: releaseId }, transaction: transaction }
//   );
// }

export async function revokeArtifactStatus(releaseId: number, transaction?: Transaction) {
  await Artifact.update(
    {
      state: "revoked",
    },
    {
      where: {
        [Op.and]: [{ release_id_fk: releaseId }, { build_status: "production-build" }],
      },
      transaction: transaction,
    },
  );
}

export async function updateArtifactStatus(
  releaseId: number,
  filename: string,
  buildStatus: ArtifactBuildStatus,
  transaction?: Transaction,
) {
  await Artifact.update(
    {
      state: "processed",
      build_status: buildStatus,
    },
    {
      where: {
        [Op.and]: [{ release_id_fk: releaseId }, { filename: filename }],
      },
      transaction: transaction,
    },
  );
}
