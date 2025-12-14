import {
  ReleaseBaseQueryParam,
  ReleaseBaseQueryParamSchema,
  ReleaseDTO,
  ReleaseIdQueryParam,
  ReleaseIdQueryParamSchema,
  ReleaseSchema,
  ReleaseStatusQueryParam,
  ReleaseStatusQueryParamSchema,
  ReleaseStatusUpdateDTO,
  ReleaseStatusUpdateSchema,
} from "@schemas/release.schema";
import { ArtifactReleaseService } from "@services/release.service";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { ReleaseArtifactCreationResponse, ReleaseListArtifactsResponse } from "types";

@injectable()
export class ArtifactReleaseController {
  constructor(
    @inject(ArtifactReleaseService)
    private readonly _release: ArtifactReleaseService
  ) {}

  async createRelease(
    request: Request<undefined, undefined, ReleaseDTO>,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = await ReleaseSchema.parseAsync(request.body);
      const releaseId = await this._release.createRelease(body);
      response.status(StatusCodes.ACCEPTED).json({
        message: "Artifact release has been created!",
        releaseId: releaseId,
        status: {
          reason: getReasonPhrase(StatusCodes.ACCEPTED),
          code: StatusCodes.ACCEPTED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async promoteReleaseStatus(
    request: Request<undefined, undefined, ReleaseStatusUpdateDTO>,
    response: Response<ReleaseArtifactCreationResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = await ReleaseStatusUpdateSchema.parseAsync(request.body);
      await this._release.promoteRelease(body);
      response.status(StatusCodes.OK).json({
        message: `Release has been promoted as ${body.status}!`,
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
    request: Request<undefined, undefined, undefined, ReleaseIdQueryParam>,
    response: Response<ReleaseArtifactCreationResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const body = await ReleaseIdQueryParamSchema.parseAsync(request.body);
      await this._release.removeRelease(body);
      response.status(StatusCodes.OK).json({
        message: "Release artifact has been removed successfully!",
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
    request: Request<undefined, undefined, undefined, ReleaseBaseQueryParam>,
    response: Response<ReleaseListArtifactsResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = await ReleaseBaseQueryParamSchema.parseAsync(request.query);
      const releases = await this._release.getAllReleases(query);
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
    request: Request<undefined, undefined, undefined, ReleaseStatusQueryParam>,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = await ReleaseStatusQueryParamSchema.parseAsync(request.query);
      const release = await this._release.getLatestRelease(query);
      const updatedRelease = {
        ...release,
        artifact: {
          ...release?.artifact,
          downloadURL: `http://localhost:3000/api/v1/releases/${release?.id}/downloads/${release?.artifact?.id}`,
        },
      };

      delete updatedRelease.createdAt;
      delete updatedRelease.artifact.id;
      delete updatedRelease.artifact.filename;

      response.status(StatusCodes.OK).json({
        release: updatedRelease,
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
