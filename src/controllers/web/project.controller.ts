import { ProjectDTO, ProjectIdQueryParam, ProjectSchema } from "@schemas/project.schema";
import { ProjectService } from "@services/project.service";
import { NextFunction, Response, Request } from "express";
import { inject, injectable } from "tsyringe";
import { StatusCodes } from "http-status-codes";
import { ProjectCreationResponse, ProjectDeletedResponse, ProjectListResponse } from "../../types";
import { ZodError } from "zod";
import { ApiError } from "@utils/error";
import { User } from "@models/user.model";

// todo handle the problem when same name project is created....handle at frontend client layer....
@injectable()
export class ProjectController {
  constructor(
    @inject(ProjectService)
    private readonly _project: ProjectService,
  ) {}

  async postProject(
    request: Request<undefined, undefined, ProjectDTO>,
    response: Response<ProjectCreationResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId, projectName, boardType } = await ProjectSchema.parseAsync(request.body);
      await this._project.createProject(userId, projectName, boardType);
      response.redirect(request.originalUrl);
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(StatusCodes.BAD_REQUEST).render("dashboard", {
          message: error.issues[0].message,
        });
      }

      if (error instanceof ApiError) {
        response.status(StatusCodes.BAD_REQUEST).render("dashboard", {
          message: error.message,
        });
      }
    }
  }

  async getProjects(
    request: Request,
    response: Response<ProjectListResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (request.user as unknown as User).public_id!;
      const projects = await this._project.getAllProjects(userId);
      response.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      response.set("Pragma", "no-cache");
      response.set("Expires", "0");
      response.status(StatusCodes.OK).render("dashboard", {
        projects: projects,
        userId: userId,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(StatusCodes.BAD_REQUEST).render("dashboard", {
          message: error.issues[0].message,
        });
      }

      if (error instanceof ApiError) {
        response.status(StatusCodes.BAD_REQUEST).render("dashboard", {
          message: error.message,
        });
      }
    }
  }

  // under development....
  removeProject(
    request: Request<undefined, undefined, undefined, ProjectIdQueryParam>,
    response: Response<ProjectDeletedResponse>,
    next: NextFunction,
  ): void {
    throw new Error("Not Implemented Yet!");
  }
}
