import {
  ProjectDTO,
  ProjectIdPathParam,
  ProjectIdPathParamSchema,
  ProjectSchema,
} from "@schemas/project.schema";
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

  async removeProject(
    request: Request<ProjectIdPathParam>,
    response: Response<ProjectDeletedResponse, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await ProjectIdPathParamSchema.parseAsync(request.params);
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
}
