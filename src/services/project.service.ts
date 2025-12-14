import { db } from "@config/db.config";
import * as UserDAL from "@dal/auth.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { Project } from "@models/project.model";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import {
  ProjectDTO,
  ProjectIdQueryParam,
  ProjectIdQueryParamSchema,
  ProjectSchema,
} from "@schemas/project.schema";
import { UserIdQueryParam, UserIdQueryParamSchema } from "@schemas/user.schema";
import { injectable } from "tsyringe";

@injectable()
export class ProjectService {
  async createProject(payload: ProjectDTO): Promise<Project> {
    const { userId, projectName, boardType } = await ProjectSchema.parseAsync(payload);

    const user = await UserDAL.findUserByPublicId(userId);

    if (!user) {
      throw new ApiError("User not found!", StatusCodes.NOT_FOUND);
    }

    if (await ProjectDAL.isProjectNameInUse(user.id!, projectName)) {
      throw new ApiError("Project with this name is already in use!", StatusCodes.CONFLICT);
    }

    const projectData = await ProjectDAL.createProject({
      userId: user.id!,
      name: projectName,
      boardType: boardType,
    });

    return projectData;
  }

  // TODO get all user projects with pagination......
  async getAllProjects(queryParam: UserIdQueryParam): Promise<readonly Project[]> {
    const { userId } = await UserIdQueryParamSchema.parseAsync(queryParam);

    const user = await UserDAL.findUserByPublicId(userId);

    if (!user) {
      throw new ApiError("User not found!", StatusCodes.NOT_FOUND);
    }

    return await ProjectDAL.findProjectsByUserId(user.id!);
  }

  async softDeleteProject(queryParam: ProjectIdQueryParam): Promise<void> {
    const { projectId } = await ProjectIdQueryParamSchema.parseAsync(queryParam);
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }

    const transaction = await db.transaction();
    try {
      await ReleaseDAL.deleteAllReleases(project.id!, transaction);
      await ProjectDAL.deleteProject(project.id!, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
