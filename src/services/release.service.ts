import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ReleaseAttributesDTO } from "@models/release.model";
import {
  ReleaseBaseQueryParam,
  ReleaseBaseQueryParamSchema,
  ReleaseDTO,
  ReleaseIdQueryParam,
  ReleaseStatusQueryParam,
  ReleaseStatusUpdateDTO,
} from "@schemas/release.schema";
import { ApiError } from "@utils/error";
import { Logger } from "@utils/logger";
import * as Utils from "@utils/utils";
import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { CacheService } from "./cache.service";

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
    @inject(CacheService)
    private readonly _cache: CacheService
  ) {}

  public async createRelease(payload: ReleaseDTO): Promise<Utils.NullableOrUndefined<string>> {
    const { projectId, version, changelog } = payload;

    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    if (!Utils.isSemver(version)) {
      throw new ApiError(
        `${version} is not a valid semantic version format!`,
        StatusCodes.BAD_REQUEST
      );
    }

    const normalizedVersion = Utils.getNormalizedVersion(version);

    const collision = await ReleaseDAL.hasVersionCollision(normalizedVersion);
    if (collision) {
      throw new ApiError(
        `Artifact version ${version} should be greater than the most recent previous release ${collision.version}!`,
        StatusCodes.BAD_REQUEST
      );
    }

    const release = await ReleaseDAL.createRelease(
      project.id!,
      version,
      normalizedVersion,
      changelog
    );

    return release.public_id;
  }

  public async removeRelease(queryParam: ReleaseIdQueryParam): Promise<void> {
    const { id } = queryParam;

    const release = await ReleaseDAL.findReleaseByPublicId(id);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    await ReleaseDAL.deleteReleaseByPublicId(id);
    Logger.info("Release has been removed successfully!");
  }

  public async getAllReleases(
    queryParam: ReleaseBaseQueryParam
  ): Promise<readonly ReleaseAttributesDTO[]> {
    const { projectId, status, limit, offset } = queryParam;
    await ReleaseBaseQueryParamSchema.parseAsync(queryParam);
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    const releases = await ReleaseDAL.getAllReleases(
      project.id!,
      status ?? "all",
      limit ?? 10,
      offset ?? 0
    );
    return releases.map((e) => e.toDTO());
  }

  public async getLatestRelease(
    queryParam: ReleaseStatusQueryParam
  ): Promise<Utils.Nullable<ReleaseAttributesDTO>> {
    const { projectId, status } = queryParam;

    const uniqueKey = projectId.concat(":").concat(status);
    const isEmpty = await this._cache.isEmpty(uniqueKey);
    if (!isEmpty) {
      const cachedRelease = JSON.parse(await this._cache.get(uniqueKey)) as ReleaseAttributesDTO;
      Logger.info(`Release: ${uniqueKey} cache hit!`);
      return cachedRelease;
    }

    const project = await ProjectDAL.findProjectByPublicId(projectId);
    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    const release = await ReleaseDAL.getLatestRelease(project.id!, status ?? "staging");
    if (!release) {
      throw new ApiError(`Latest ${status ?? "staging"} release not found!`, StatusCodes.NOT_FOUND);
    }

    await this._cache.add(uniqueKey, JSON.stringify(release.toDTO()));
    Logger.info(`${uniqueKey} added to cache!`);

    return release.toDTO();
  }

  public async promoteRelease(dto: ReleaseStatusUpdateDTO): Promise<void> {
    const { releaseId, status } = dto;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    const project = await ProjectDAL.findProjectByInternalId(release.project_id_fk!);
    if (!project) {
      throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);
    }

    if (release.status === status) {
      throw new ApiError(`Release is already set as ${status}`, StatusCodes.CONFLICT);
    }

    if (status === "production" && release.status === "draft") {
      throw new ApiError(
        `Release can only be promoted to production from staging only!`,
        StatusCodes.BAD_REQUEST
      );
    }

    if (status === "staging" && release.status === "production") {
      throw new ApiError(
        `Release cannot be downgraded from production to staging!`,
        StatusCodes.BAD_REQUEST
      );
    }

    // !handle them via transactions....
    await ReleaseDAL.updateStatus(releaseId, status);
    await ReleaseDAL.setProductionReleaseDate(releaseId);

    // evicting project's latest stale release from cache.....
    const projectId = project.public_id;
    const uniqueKey = projectId!.concat(":").concat("staging");
    if (!(await this._cache.isEmpty(uniqueKey))) {
      await this._cache.evict(uniqueKey);
      Logger.info(`${uniqueKey} evicted from cache!`);
    }
  }
}
