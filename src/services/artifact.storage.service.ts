import { db } from "@config/db.config";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ArtifactDTO } from "@models/release.model";
import { ReleaseArtifactIdPathParams, ReleaseIdPathParam } from "@schemas/release.schema";
import { StorageManager } from "@services/storage.manager";
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
    callback(null, StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH);
  },
  filename: function (_, file, callback) {
    const id = crypto.randomUUID();
    const timestamps = Date.now();
    const uniqueFilename = `${timestamps}-${id}${path.extname(file.originalname)}`;
    callback(null, uniqueFilename);
  },
});

export const MAX_FILE_SIZE_IN_BYTES = 8e6; // 8mb in bytes....
export const upload = multer({ storage: storage });

@injectable()
export class ArtifactStorageService {
  constructor(
    @inject(ReleaseCacheService)
    private readonly _cache: ReleaseCacheService,
  ) {}

  public async remove(payload: ReleaseArtifactIdPathParams): Promise<void> {
    const { releaseId, artifactId } = payload;
    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.BAD_REQUEST);
    }

    const artifact = await ArtifactDAL.findArtifactById(artifactId);

    if (!artifact) {
      throw new ApiError("Artifact not found!", StatusCodes.NOT_FOUND);
    }

    if (release.isRevoked() || release.isProduction()) {
      throw new ApiError(
        `${release.getChannel()} release artifact cannot be deleted!`,
        StatusCodes.CONFLICT,
      );
    }

    const transaction = await db.transaction();
    try {
      await ArtifactDAL.deleteByFilename(artifact.getFileName(), transaction);
      await ReleaseDAL.updateReleaseChannel(releaseId, "draft", transaction);

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
      throw error;
    }
  }

  public async getBinaryFilePath(params: ReleaseArtifactIdPathParams): Promise<string> {
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
      StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH,
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

    if (release.isProduction() || release.isStaging()) {
      throw new ApiError(
        `Cannot upload artifact on a ${release.getChannel()} mode release!`,
        StatusCodes.CONFLICT,
      );
    }

    // *on new file upload remove the old artifact record....
    const artifactData = await ArtifactDAL.findArtifactByReleaseId(release.getId());
    if (artifactData) {
      await artifactData.destroy({ force: true });
    }

    const pathToFile = path.join("storage", file.filename);
    const hash = await Utils.generateFileHash(pathToFile);

    const collisionRelease = await ProjectDAL.isHashFoundAcrossReleases(
      release.getProjectForeignKeyId(),
      hash,
    );

    if (collisionRelease) {
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
}
