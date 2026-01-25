import { db } from "@config/db.config";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ArtifactDTO } from "@models/release.model";
import { ReleaseArtifactIdPathParams, ReleaseIdPathParam } from "@schemas/release.schema";
import { FileStorageOperation } from "@utils/common";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import * as Utils from "@utils/utils";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";
import multer from "multer";
import * as path from "node:path";
import { inject, injectable } from "tsyringe";
import { ReleaseCacheService } from "./cache.service";

const storage = multer.diskStorage({
  destination: function (_, __, callback) {
    callback(null, FileStorageOperation.DEFAULT_FILE_STORAGE_PATH);
  },
  filename: function (_, file, callback) {
    const id = crypto.randomUUID();
    const originalFilename = file.originalname;
    const uniqueFilename = `$${id}-${originalFilename}`;
    callback(null, uniqueFilename);
  },
});

export const MAX_FILE_SIZE_IN_BYTES = 8e6; // 8mb in bytes....
export const upload = multer({ storage: storage });

/**
 * TODO: [PRI-02] Remove the FileStorageOperation operations from this service....
 */
// ** [DONE] implement file dedup checks.......
@injectable()
export class ArtifactStorageService {
  constructor(
    @inject(ReleaseCacheService)
    private readonly _cache: ReleaseCacheService,
  ) {}

  public async deleteBlob(payload: ReleaseArtifactIdPathParams) {
    const { releaseId, artifactId } = payload;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    const artifact = await ArtifactDAL.findArtifactById(artifactId);

    if (!artifact) {
      throw new ApiError("File not found!", StatusCodes.NOT_FOUND);
    }

    if (release.isRevoked()) {
      throw new ApiError("Revoked release artifact cannot be deleted!", StatusCodes.CONFLICT);
    }

    if (release.isProduction()) {
      throw new ApiError("Production release artifact cannot be deleted!", StatusCodes.CONFLICT);
    }

    const transaction = await db.transaction();
    try {
      await ArtifactDAL.deleteByFilename(artifact.getFileName(), transaction);
      await ReleaseDAL.updateReleaseChannel(releaseId, "draft", transaction);
      await FileStorageOperation.removePermanently(artifact.getFileName(), "storage");

      const project = await ProjectDAL.findProjectByInternalId(release.getProjectForeignKeyId());

      // * invalidate staging release if exist in cache store....
      // * as release falls back to draft state on artifact deletion....
      const { isInvalidated, cacheKey } = await this._cache.invalidateCache(
        project!.getPublicId(),
        "staging",
      );
      if (isInvalidated) {
        Logger.info(`Invalidated artifact ${cacheKey} from cache!`);
      }
      await transaction.commit();
      Logger.info("Artifact deleted!");
    } catch (error) {
      Logger.error("Artifact Deletion Error ", error as string);
      await transaction.rollback();
    }
  }

  public async findUploadedArtifacts(releaseId: string) {
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    const artifact = await ArtifactDAL.findArtifactByInternalId(release.getId());

    if (!artifact) {
      throw new ApiError("artifact not found!", StatusCodes.NOT_FOUND);
    }

    return artifact;
  }

  public async getBinaryFilePath(params: ReleaseArtifactIdPathParams) {
    const { releaseId, artifactId } = params;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    const artifact = await ArtifactDAL.findArtifactById(artifactId);

    if (!artifact) {
      throw new ApiError("artifact not found!", StatusCodes.NOT_FOUND);
    }

    const pathToFile = path.join(
      FileStorageOperation.DEFAULT_FILE_STORAGE_PATH,
      artifact.getFileName(),
    );

    return pathToFile;
  }

  public async save(
    file: Pick<
      Express.Multer.File,
      "filename" | "originalname" | "mimetype" | "size" | "fieldname"
    >,
    param: ReleaseIdPathParam,
  ): Promise<ArtifactDTO> {
    const { releaseId } = param;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    /**
     * * If new file is uploaded and has no conflict with prior release artifacts then it gets saved to db....
     * * If again same file is uploaded then "Same artifact already exists!" error is thrown...
     * * If new file is uploaded after first successful save then "Another artifact already exists!" error is thrown..
     */
    const hash = await Utils.generateFileHash(path.join("storage", file.filename));

    if (await ArtifactDAL.isHashFound(release.getId(), hash)) {
      const artifact = await ArtifactDAL.findPendingArtifact(release.getId(), file.originalname);
      await artifact?.destroy({ force: true });
      await this.deleteBinaryFromStorage(artifact!.filename!);
    }

    const collisionRelease = await ProjectDAL.isHashFoundAcrossReleases(
      release.getProjectForeignKeyId(),
      hash,
    );

    if (collisionRelease) {
      await this.deleteBinaryFromStorage(file.filename);
      throw new ApiError(
        `Collision detected with release v${collisionRelease.Releases![0].version}!`,
        StatusCodes.CONFLICT,
      );
    }

    const artifact = await ArtifactDAL.createOrUpdate(release.getId(), {
      filename: file.filename,
      size: file.size,
      hash: hash,
      originalFileName: file.originalname,
    });

    return artifact.toDTO();
  }

  public async deleteBinaryFromStorage(filename: string): Promise<void> {
    try {
      await FileStorageOperation.removePermanently(filename, "storage");
      Logger.info("file deleted! ".concat(filename));
    } catch (error) {
      Logger.error((error as Error).message);
      throw error;
    }
  }
}
