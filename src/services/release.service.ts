import { db } from "@config/db.config";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { Nullable, NullableOrUndefined } from "../types";
import { ReleaseAttributesDTO } from "@models/release.model";
import { ProjectIdPathParam } from "@schemas/project.schema";
import {
  ReleaseArtifactIdPathParams,
  ReleaseBaseQueryParam,
  ReleaseChannelQueryParam,
  ReleaseIdPathParam,
} from "@schemas/release.schema";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import * as Utils from "@utils/utils";
import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { ReleaseCacheService } from "./cache.service";

/**
 * @description currently under development
 *
 * * This issue has been PATCHED via getNormalizedVersion
 *
 * ! [PRI- 0]:
 * !       Critical Edgecase found related to [flattenVersion] function...
 * !
 * ! Problem:
 * !       x = 1.10.2  = 1102
 * !       y = 1.9.10  = 1910
 * !
 * !       x > y = False (while it shouldnt due to semver rules)
 * !
 * !
 * !       Technically MINOR version of x is greater than the MINOR version of y but conversion
 * !       made the y greater than x that breaks the whole ReleaseArtifactService...
 * !
 * ! Proposed Solution to pad upto 5 or 7 0s digits at start of MINOR and PATCH versions:
 * ! Case #1:
 * !       x  = 1.10.2    = 1102
 * !       y  = 1.9.10    = 1910
 * !
 * !       x > y => False
 * !
 * ! After Solution:
 * !       x` = 1.10.2    = 10001000002  = padded version ...
 * !       y` = 1.9.10    = 10000900010  = padded version ...
 * !       x` > y` => True
 * !
 * ! Case #2:
 * !       x`` = 1.2.1        = 121
 * !       y`` = 1.1.10500    = 1110500
 * !
 * !       x`` > y`` => False
 * !
 * ! After Solution:
 * !       x`` = 1.2.1        = 10000200001
 * !       y`` = 1.1.10500    = 10000110500
 * !
 * !       x`` > y`` => True
 *
 */

@injectable()
export class ArtifactReleaseService {
  constructor(
    @inject(ReleaseCacheService)
    private readonly _cache: ReleaseCacheService,
  ) {}

  public async createRelease(
    projectId: string,
    version: string,
    changelog: string,
  ): Promise<NullableOrUndefined<string>> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    if (!Utils.isSemver(version)) {
      throw new ApiError(
        `${version} is not a valid semantic version format!`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const normalizedVersion = Utils.getNormalizedVersion(version);

    const collisionRelease = await ReleaseDAL.hasVersionCollision(
      project.getId(),
      normalizedVersion,
    );

    if (collisionRelease) {
      throw new ApiError(
        `Artifact version v${version} should be greater than the most recent previous release v${collisionRelease.getVersion()}!`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const releases = await ReleaseDAL.getAllReleases(project.getId(), "all");
    const mostRecentPriorRelease = releases[0];
    const hasNotMostRecentPriorProdRelease =
      releases.length > 0 &&
      (mostRecentPriorRelease.isDraft() || mostRecentPriorRelease.isStaging());

    if (hasNotMostRecentPriorProdRelease) {
      throw new ApiError(
        `Release cannot be created as most prior latest release v${mostRecentPriorRelease.getVersion()} is still in ${mostRecentPriorRelease.getChannel()} mode.`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const release = await ReleaseDAL.createRelease(
      project.getId(),
      version,
      normalizedVersion,
      changelog,
    );

    return release.getPublicId();
  }

  public async removeRelease(pathParam: ReleaseIdPathParam): Promise<void> {
    const { releaseId } = pathParam;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    if (release.isProduction()) {
      throw new ApiError("Production release cannot be deleted!", StatusCodes.BAD_REQUEST);
    }

    if (release.isDraft() || release.isStaging()) {
      try {
        await ReleaseDAL.deleteReleaseByPublicId(releaseId);
        Logger.info("Release successfully deleted");
      } catch (error) {
        Logger.error(error as string);
        throw error;
      }
    }
  }

  public async getAllReleases(
    param: ProjectIdPathParam,
    queryParam: ReleaseBaseQueryParam,
  ): Promise<readonly ReleaseAttributesDTO[]> {
    const { projectId } = param;
    const { channel, limit, offset } = queryParam;
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    const releases = await ReleaseDAL.getAllReleases(
      project.getId(),
      channel ?? "all",
      limit ?? 10,
      offset ?? 0,
    );
    return releases.map((e) => e.toDTO());
  }

  public async getLatestRelease(
    queryParam: ReleaseChannelQueryParam,
    projectId: string,
    apiKey: string,
  ): Promise<Nullable<ReleaseAttributesDTO>> {
    const { channel } = queryParam;
    const { cacheKey, cachedData } = await this._cache.getChannelBased<ReleaseAttributesDTO>(
      projectId,
      channel,
    );

    if (cachedData) {
      Logger.info(`Release ${cacheKey} cache hit!`);
      return cachedData;
    }

    const isMutexLockAcquired = await this._cache.acquireMutexLock({ mutexKey: cacheKey });
    if (!isMutexLockAcquired) {
      Logger.info("Mutex lock already acquired!");
      return cachedData;
    }

    try {
      Logger.info("Mutex lock acquired!");
      const project = await ProjectDAL.findProjectByPublicIdAndApiKey(projectId, apiKey);
      if (!project) {
        throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
      }

      const release = await ReleaseDAL.getLatestReleaseByProjectId(
        project.getId(),
        channel ?? "staging",
      );

      if (!release) {
        throw new ApiError(
          `Latest ${channel ?? "staging"} release not found!`,
          StatusCodes.NOT_FOUND,
        );
      }

      const { isCached, cacheKey: key } = await this._cache.addChannelBased(
        projectId,
        release.toDTO(),
        channel,
      );

      if (isCached) {
        Logger.info(`Release ${key} added to cache!`);
      }

      return release.toDTO();
    } catch (error) {
      Logger.error((error as Error).message);
      throw error;
    } finally {
      await this._cache.releaseMutexLock({ mutexKey: cacheKey });
      Logger.info("Mutex lock released!");
    }
  }

  public async revoke(pathParam: ReleaseArtifactIdPathParams): Promise<void> {
    const { releaseId, artifactId } = pathParam;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    const artifact = await ArtifactDAL.findArtifactById(artifactId);
    if (!artifact) {
      throw new ApiError("Artifact file not found!", StatusCodes.NOT_FOUND);
    }

    if (!release.isProduction()) {
      throw new ApiError("Only production releases can be revoked only!", StatusCodes.BAD_REQUEST);
    }

    const latestRelease = await ReleaseDAL.getLatestProductionRelease();
    if (releaseId !== latestRelease!.getPublicId()) {
      throw new ApiError("Only latest production release can be revoked!", StatusCodes.BAD_REQUEST);
    }

    const transaction = await db.transaction();
    try {
      await ReleaseDAL.updateReleaseChannel(release.getPublicId(), "revoked", transaction);
      await ArtifactDAL.revokeArtifactStatus(release.getId(), transaction);
      await transaction.commit();

      const project = await ProjectDAL.findProjectByInternalId(release.getProjectForeignKeyId());
      const { isInvalidated, cacheKey } = await this._cache.invalidateCache(
        project!.getPublicId(),
        "production",
      );

      if (isInvalidated) {
        Logger.info(`Invalidated release ${cacheKey} from cache!`);
      }
    } catch (error) {
      await transaction.rollback();
      Logger.error(error as string);
      throw error;
    }
  }

  public async promoteToProduction(pathParam: ReleaseArtifactIdPathParams): Promise<void> {
    const { releaseId, artifactId } = pathParam;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    const artifact = await ArtifactDAL.findReleaseArtifactById(release.getId(), artifactId);
    if (!artifact) {
      throw new ApiError("Artifact file not found!", StatusCodes.NOT_FOUND);
    }

    const project = await ProjectDAL.findProjectByInternalId(release.getProjectForeignKeyId());
    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    if (release.isRevoked()) {
      throw new ApiError(
        `Revoked production releases cannot be promoted again!`,
        StatusCodes.CONFLICT,
      );
    }

    if (release.isDraft()) {
      throw new ApiError(
        `Only staging release can be promoted to production! Current release is in draft mode.`,
        StatusCodes.CONFLICT,
      );
    }

    if (release.isProduction()) {
      throw new ApiError("Release already locked as a production channel!", StatusCodes.CONFLICT);
    }

    if (release.isStaging()) {
      const transaction = await db.transaction();
      try {
        await ReleaseDAL.updateReleaseChannel(releaseId, "production", transaction);
        await ReleaseDAL.setProductionReleaseDate(releaseId, transaction);
        await transaction.commit();

        // * remove staging key from cache on promotion
        // * but also try to remove the prior prod release from cache as well....
        // * otherwise this release would be in production but devices
        // * on the other hand would still be getting the stale prior prod release meta data
        // * via [getLatestRelease]......
        const { staging, production } = await this._cache.invalidateCacheChannels(
          project.getPublicId(),
        );

        if (staging.wasCached) {
          Logger.info(`Invalidated staging release ${staging.key} from cache!`);
        }

        if (production.wasCached) {
          Logger.info(`Invalidated production release ${production.key} from cache!`);
        }
      } catch (error) {
        Logger.error("Error ", error as string);
        await transaction.rollback();
        throw error;
      }
    }
  }
}
