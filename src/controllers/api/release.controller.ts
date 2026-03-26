import { EnvConfig } from "@config/config";
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
} from "@schemas/release.schema";
import { ArtifactReleaseService } from "@services/release.service";
import { ApiError } from "@utils/error";
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
      await this._release.promoteToProduction(params);
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
        message: "Release has been successfully removed!",
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async restoreRelease(
    request: Request<ReleaseIdPathParam>,
    response: Response<ReleaseArtifactCreationResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ReleaseIdPathParamSchema.parseAsync(request.params);
      await this._release.restoreRelease(param);
      response.status(StatusCodes.OK).json({
        message: "Release has been successfully restored!",
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
      response.status(StatusCodes.OK).json({
        releases: releases,
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
    request: Request<undefined, undefined, undefined, ReleaseChannelQueryParam>,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const apiKey = request.get("x-api-key");
      const projectId = request.get("x-project-id");

      if (!apiKey && !projectId) {
        throw new ApiError(
          "x-api-key and x-project-id header is required!",
          StatusCodes.BAD_REQUEST,
        );
      }

      if (!apiKey) {
        throw new ApiError("x-api-key header is required!", StatusCodes.BAD_REQUEST);
      }

      if (!projectId) {
        throw new ApiError("x-project-id header is required!", StatusCodes.BAD_REQUEST);
      }

      const query = await ReleaseChannelQueryParamSchema.parseAsync(request.query);
      const release = await this._release.getLatestRelease(query, projectId, apiKey);

      const downloadURL = `${EnvConfig.BASE_URL}/internal/api/v1/releases/${release?.id}/artifacts/${release?.artifact?.id}/download`;
      release!.artifact!.prettySize = prettyBytes(release!.artifact!.size);
      release!.changeLog = await marked.marked(release!.changeLog);
      delete release!.createdAt;
      const releaseWithDownloadUrl = {
        ...release,
        artifact: {
          ...release?.artifact,
          downloadURL: downloadURL,
        },
      };
      response.status(StatusCodes.OK).json({
        release: releaseWithDownloadUrl,
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
