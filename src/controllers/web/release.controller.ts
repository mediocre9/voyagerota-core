import { ProjectIdPathParam, ProjectIdPathParamSchema } from "@schemas/project.schema";
import {
  ReleaseBaseQueryParamSchema,
  ReleaseIdQueryParam,
  ReleaseIdQueryParamSchema,
} from "@schemas/release.schema";
import { ProjectService } from "@services/project.service";

import { ArtifactReleaseService } from "@services/release.service";
import { ApiError } from "@utils/error";

import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { ReleaseArtifactCreationResponse } from "../../types";
import { ZodError } from "zod";
import prettyBytes from "pretty-bytes";

@injectable()
export class ArtifactReleaseController {
  constructor(
    @inject(ArtifactReleaseService)
    private readonly _release: ArtifactReleaseService,
    @inject(ProjectService)
    private readonly _project: ProjectService,
  ) {}

  async removeRelease(
    request: Request<undefined, undefined, undefined, ReleaseIdQueryParam>,
    response: Response<ReleaseArtifactCreationResponse>,
    next: NextFunction,
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

  async getReleases(
    request: Request<ProjectIdPathParam>,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ProjectIdPathParamSchema.parseAsync(request.params);
      const query = await ReleaseBaseQueryParamSchema.parseAsync(request.params);
      const releases = await this._release.getAllReleases(param, query);
      const project = await this._project.findProjectByPublicId(param.projectId);
      response.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      response.set("Pragma", "no-cache");
      response.set("Expires", "0");

      response.render("releases", {
        projectId: project.getPublicId(),
        projectName: project.getProjectName(),
        apiKey: project.getApiKey(),
        releases: releases.map((release) => ({
          ...release,
          artifact: release.artifact
            ? {
                ...release.artifact,
                prettySize:
                  release.artifact.size != null
                    ? prettyBytes(release.artifact.size)
                    : release.artifact.prettySize,
              }
            : null,
        })),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(StatusCodes.BAD_REQUEST).render("releases", {
          message: error.issues[0].message,
        });
      }

      if (error instanceof ApiError) {
        response.status(StatusCodes.BAD_REQUEST).render("releases", {
          message: error.message,
        });
      }
    }
  }
}
