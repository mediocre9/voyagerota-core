import { db } from "@config/db.config";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ReleaseArtifactIdPathParams, ReleaseIdPathParam } from "@schemas/release.schema";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import * as Utils from "@utils/utils";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";
import multer from "multer";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { injectable } from "tsyringe";

const storage = multer.diskStorage({
  destination: function (request, file, callback) {
    callback(null, path.join(import.meta.dirname, "..", "..", "storage"));
  },
  filename: function (request, file, callback) {
    const id = crypto.randomUUID();
    const originalFilename = file.originalname;
    const uniqueFilename = `$${id}-${originalFilename}`;
    callback(null, uniqueFilename);
  },
});

export const MAX_FILE_SIZE_IN_BYTES = 8e6; // 8mb in bytes....
export const upload = multer({ storage: storage });

// ** [DONE] implement file dedup checks.......
@injectable()
export class ArtifactStorageService {
  public async deleteBlob(payload: ReleaseArtifactIdPathParams) {
    const { releaseId, artifactId } = payload;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    const artifact = await ArtifactDAL.findArtifactById(artifactId);

    if (!artifact) {
      throw new ApiError("File blob not found!", StatusCodes.NOT_FOUND);
    }

    const fileStoragePath = path.join(
      import.meta.dirname,
      "..",
      "..",
      "storage",
      artifact.filename!
    );

    // !use transactions...
    await ArtifactDAL.deleteByFilename(artifact.filename!);
    await ReleaseDAL.updateStatus(releaseId, "draft");
    await fs.rm(fileStoragePath);
    Logger.info("File deleted!");
  }

  async getBinaryFilePath(params: ReleaseArtifactIdPathParams) {
    const { releaseId, artifactId } = params;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    const artifact = await ArtifactDAL.findArtifactById(artifactId);

    if (!artifact) {
      throw new ApiError("artifact not found!", StatusCodes.NOT_FOUND);
    }

    const fileStoragePath = path.join(
      import.meta.dirname,
      "..",
      "..",
      "storage",
      artifact.filename!
    );

    return fileStoragePath;
  }

  public async save(
    file: Pick<
      Express.Multer.File,
      "filename" | "originalname" | "mimetype" | "size" | "fieldname"
    >,
    param: ReleaseIdPathParam
  ) {
    const { releaseId } = param;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    const hash = await Utils.generateFileHash(path.join("storage", file.filename));

    const collision = await ProjectDAL.isHashFoundAcrossReleases(release.project_id_fk!, hash);

    if (collision) {
      await this.deleteBinaryFromStorage(file.filename);
      throw new ApiError(
        `Collision detected with release v${collision.Releases![0].version} with artifact id ${
          collision.Releases![0].ArtifactFiles![0].public_id
        }`,
        StatusCodes.CONFLICT
      );
    }

    if (await ArtifactDAL.isHashFound(release.id!, hash)) {
      await this.deleteBinaryFromStorage(file.filename);
      throw new ApiError("Same file already exists!", StatusCodes.CONFLICT);
    }

    const transaction = await db.transaction();
    try {
      const artifact = await ArtifactDAL.createOrUpdate(release.id!, {
        filename: file.filename,
        size: file.size,
        hash: hash,
      });

      await ReleaseDAL.updateStatus(release.public_id!, "staging");
      await transaction.commit();
      return artifact.toDTO();
    } catch (error) {
      await transaction.rollback();
      await this.deleteBinaryFromStorage(file.filename);
      throw error;
    }
  }

  async deleteBinaryFromStorage(filename: string): Promise<void> {
    const fileStoragePath = path.join(import.meta.dirname, "..", "..", "storage", filename);

    try {
      await fs.rm(fileStoragePath);
      Logger.warn("file deleted! ".concat(filename));
    } catch (error) {
      Logger.error((error as Error).message);
      throw error;
    }
  }
}
