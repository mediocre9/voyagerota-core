import { ArtifactFile } from "@models/artifact.model";
import { Nullable } from "@utils/utils";
import { Transaction } from "sequelize";

export async function findArtifactByFilename(filename: string): Promise<Nullable<ArtifactFile>> {
  const found = await ArtifactFile.findOne({
    where: { filename: filename },
  });

  return found;
}

export async function findArtifactById(id: string): Promise<Nullable<ArtifactFile>> {
  const found = await ArtifactFile.findOne({
    where: { public_id: id },
  });

  return found;
}

export async function findArtifactByReleaseId(releaseId: number): Promise<Nullable<ArtifactFile>> {
  const found = await ArtifactFile.findOne({
    where: { release_id_fk: releaseId },
  });

  return found;
}

// TODO consider soft deletion later
export async function deleteByFilename(filename: string): Promise<void> {
  await ArtifactFile.destroy({
    where: { filename: filename },
    force: true,
  });
}

export async function createOrUpdate(
  releaseId: number,
  opts?: ArtifactUpdateOptions,
  transaction?: Transaction
): Promise<ArtifactFile> {
  const [artifact, _] = await ArtifactFile.upsert(
    {
      release_id_fk: releaseId,
      hash: opts?.hash,
      filename: opts?.filename,
      size: opts?.size,
      // status: opts?.status,
    },
    { transaction: transaction }
  );
  return artifact;
}

export async function isHashFound(releaseId: number, hash: string) {
  return await ArtifactFile.findOne({
    where: { release_id_fk: releaseId, hash: hash },
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

export type ArtifactUpdateOptions = {
  filename?: string;
  size?: number;
  hash?: string;
  // status?: ReleaseStatus;
};
export async function update(
  releaseId: number,
  opts?: ArtifactUpdateOptions,
  transaction?: Transaction
) {
  await ArtifactFile.update(
    {
      filename: opts?.filename,
      size: opts?.size,
      hash: opts?.hash,
    },
    { where: { release_id_fk: releaseId }, transaction: transaction }
  );
}
