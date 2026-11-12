import { ProjectIdPathParam, ProjectIdPathParamSchema } from "@schemas/project.schema";
import {
  ReleaseBaseQueryParam,
  ReleaseBaseQueryParamSchema,
  ReleaseDTO,
  ReleaseSchema,
  ReleaseChannelQueryParam,
  ReleaseChannelQueryParamSchema,
  ReleaseArtifactIdPathParams,
  ReleaseArtifactIdPathParamsSchema,
  ReleaseIdPathParamSchema,
  ReleaseIdPathParam,
  PromotionGuardSchema,
} from "@schemas/release.schema";
import * as ReleaseDAL from "@dal/release.dal";
import * as semver from "semver";
import { ArtifactReleaseService } from "@services/release.service";
import { DeviceLocals } from "@middlewares/device.auth";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import prettyBytes from "pretty-bytes";
import { inject, injectable } from "tsyringe";
import * as marked from "marked";
import { ReleaseArtifactCreationResponse, ReleaseListArtifactsResponse } from "../../types";

@injectable()
export class ArtifactReleaseController {
  constructor(
    @inject(ArtifactReleaseService)
    private readonly _release: ArtifactReleaseService,
  ) {}

  async createRelease(
    request: Request<ProjectIdPathParam, undefined, ReleaseDTO>,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { projectId } = await ProjectIdPathParamSchema.parseAsync(request.params);
      const { version, changelog } = await ReleaseSchema.parseAsync(request.body);
      const releaseId = await this._release.createRelease(projectId, version, changelog);
      response.status(StatusCodes.CREATED).json({
        message: "Artifact release has been created!",
        releaseId: releaseId,
        status: {
          reason: getReasonPhrase(StatusCodes.CREATED),
          code: StatusCodes.CREATED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async promote(
    request: Request<ReleaseArtifactIdPathParams>,
    response: Response<ReleaseArtifactCreationResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const params = await ReleaseArtifactIdPathParamsSchema.parseAsync(request.params);
      const guard = await PromotionGuardSchema.parseAsync(request.body ?? {});
      await this._release.promoteToProduction(params, guard);
      response.status(StatusCodes.OK).json({
        message: `Release has been locked and promoted to production!`,
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async revoke(
    request: Request<ReleaseArtifactIdPathParams>,
    response: Response<ReleaseArtifactCreationResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const params = await ReleaseArtifactIdPathParamsSchema.parseAsync(request.params);
      await this._release.revoke(params);
      response.status(StatusCodes.OK).json({
        message: `Release has been revoked! This process is irreversible!`,
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async removeRelease(
    request: Request<ReleaseIdPathParam>,
    response: Response<ReleaseArtifactCreationResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ReleaseIdPathParamSchema.parseAsync(request.params);
      await this._release.removeRelease(param);
      response.status(StatusCodes.OK).json({
        message: "Release has been removed!",
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllReleases(
    request: Request<ProjectIdPathParam, undefined, undefined, ReleaseBaseQueryParam>,
    response: Response<ReleaseListArtifactsResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ProjectIdPathParamSchema.parseAsync(request.params);
      const query = await ReleaseBaseQueryParamSchema.parseAsync(request.query);
      const releases = await this._release.getAllReleases(param, query);
      const total = await this._release.countReleases(param, query);
      response.status(StatusCodes.OK).json({
        releases: releases,
        total: total,
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getLatestRelease(
    request: Request<Record<string, string>, unknown, unknown, ReleaseChannelQueryParam>,
    response: Response<unknown, DeviceLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const query = await ReleaseChannelQueryParamSchema.parseAsync(request.query);
      const release = await this._release.getLatestRelease(query, response.locals.project);

      // same origin the device used to reach us, so the link is always reachable for it
      // (LAN ip, domain behind nginx...), instead of a configured BASE_URL like localhost....
      const origin = `${request.protocol}://${request.get("host")}`;
      const downloadURL = `${origin}${request.baseUrl}/releases/${release.id}/artifacts/${release.artifact?.id}/download`;
      const { createdAt: _, ...publicRelease } = release;

      // a device running a revoked release is told to go back, even though it's an older version....
      const deviceVersion = request.get("x-firmware-version")?.trim();
      let rollback = false;
      if (deviceVersion && semver.valid(deviceVersion) && deviceVersion !== release.version) {
        const running = await ReleaseDAL.findProjectReleaseByVersion(
          response.locals.project.getId(),
          deviceVersion,
        );
        rollback = Boolean(running?.isRevoked()) && semver.lt(release.version, deviceVersion);
      }

      response.status(StatusCodes.OK).json({
        release: {
          ...publicRelease,
          rollback: rollback,
          changeLog: await marked.marked(release.changeLog),
          artifact: {
            ...release.artifact,
            prettySize: prettyBytes(release.artifact?.size ?? 0),
            downloadURL: downloadURL,
          },
        },
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
