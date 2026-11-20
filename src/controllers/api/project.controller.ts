import {
  ProjectDeleteSchema,
  ProjectDTO,
  ProjectIdPathParam,
  ProjectIdPathParamSchema,
  ProjectSchema,
} from "@schemas/project.schema";
import { getAuth } from "@clerk/express";
import { isClerkEnabled } from "@config/clerk.config";
import { DELETE_REVERIFICATION } from "@config/limits";
import { ApiError } from "@utils/error";
import { UserLocals } from "@middlewares/auth";
import { ProjectService } from "@services/project.service";
import { NextFunction, Response, Request } from "express";
import { inject, injectable } from "tsyringe";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { ProjectCreationResponse, ProjectDeletedResponse, ProjectListResponse } from "../../types";

@injectable()
export class ProjectController {
  constructor(
    @inject(ProjectService)
    private readonly _project: ProjectService,
  ) {}

  async createProject(
    request: Request<undefined, undefined, ProjectDTO>,
    response: Response<ProjectCreationResponse, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { projectName, boardType } = await ProjectSchema.parseAsync(request.body);
      const project = await this._project.createProject(
        response.locals.user.getPublicId(),
        projectName,
        boardType,
      );
      response.status(StatusCodes.CREATED).json({
        project: {
          publicId: project.public_id!,
          name: project.project_name!,
          secretKey: project.api_key!,
        },
        board: project.board_type!,
        status: {
          reason: getReasonPhrase(StatusCodes.CREATED),
          code: StatusCodes.CREATED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // deleted projects that can still be restored....
  async getDeletedProjects(
    _: Request,
    response: Response<unknown, UserLocals>,
    next: NextFunction,
  ) {
    try {
      const projects = await this._project.getDeletedProjects(response.locals.user);
      response.status(StatusCodes.OK).json({
        projects,
        status: { reason: getReasonPhrase(StatusCodes.OK), code: StatusCodes.OK },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjects(
    _: Request,
    response: Response<ProjectListResponse, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const projects = await this._project.getAllProjects(response.locals.user.getPublicId());
      response.status(StatusCodes.OK).json({
        projects: projects,
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeleteCheck(
    request: Request<ProjectIdPathParam>,
    response: Response<unknown, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ProjectIdPathParamSchema.parseAsync(request.params);
      const check = await this._project.getDeleteCheck(param.projectId, response.locals.user);
      response.status(StatusCodes.OK).json({
        check,
        status: { reason: getReasonPhrase(StatusCodes.OK), code: StatusCodes.OK },
      });
    } catch (error) {
      next(error);
    }
  }

  async removeProject(
    request: Request<ProjectIdPathParam>,
    response: Response<unknown, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ProjectIdPathParamSchema.parseAsync(request.params);
      const check = await this._project.getDeleteCheck(param.projectId, response.locals.user);

      // the dashboard dialog is not the guard, this is: a project that reaches real boards
      // needs the typed phrase and a fresh sign in....
      if (check.atStake) {
        const body = await ProjectDeleteSchema.parseAsync(request.body ?? {});
        if (body.confirm !== check.phrase) {
          throw new ApiError(`Type "${check.phrase}" to confirm.`, StatusCodes.BAD_REQUEST);
        }
        const verified =
          isClerkEnabled() && getAuth(request).has({ reverification: DELETE_REVERIFICATION });
        if (!verified) {
          // clerk's own hint, the dashboard opens the sign in check and sends the request again....
          response.status(StatusCodes.FORBIDDEN).json({
            clerk_error: {
              type: "forbidden",
              reason: "reverification-error",
              metadata: { reverification: DELETE_REVERIFICATION },
            },
          });
          return;
        }
      }

      await this._project.softDeleteProject(param.projectId, response.locals.user);
      response.status(StatusCodes.ACCEPTED).json({
        message: "Project has been deleted successfully!",
        status: {
          reason: getReasonPhrase(StatusCodes.ACCEPTED),
          code: StatusCodes.ACCEPTED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async restoreProject(
    request: Request<ProjectIdPathParam>,
    response: Response<ProjectDeletedResponse, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ProjectIdPathParamSchema.parseAsync(request.params);
      await this._project.restoreProject(param.projectId, response.locals.user);
      response.status(StatusCodes.ACCEPTED).json({
        message: "Project has been accepted for restoration!",
        status: {
          reason: getReasonPhrase(StatusCodes.ACCEPTED),
          code: StatusCodes.ACCEPTED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async keepProject(
    request: Request<ProjectIdPathParam>,
    response: Response<ProjectDeletedResponse, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ProjectIdPathParamSchema.parseAsync(request.params);
      await this._project.keepProject(param.projectId, response.locals.user);
      response.status(StatusCodes.OK).json({
        message: "Project will be kept!",
        status: { reason: getReasonPhrase(StatusCodes.OK), code: StatusCodes.OK },
      });
    } catch (error) {
      next(error);
    }
  }

  async keepProjectByToken(
    request: Request<unknown, unknown, { token?: string }>,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const projectName = await this._project.keepProjectByToken(String(request.body?.token ?? ""));
      response.status(StatusCodes.OK).json({
        message: "Project will be kept!",
        projectName: projectName,
        status: { reason: getReasonPhrase(StatusCodes.OK), code: StatusCodes.OK },
      });
    } catch (error) {
      next(error);
    }
  }
}
