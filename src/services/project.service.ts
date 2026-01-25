import { db } from "@config/db.config";
import * as UserDAL from "@dal/user.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { Project } from "@models/project.model";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";

export interface ProjectDTOFields {
  id: string;
  projectName: string;
  boardType: string;
  totalReleases: number;
  apiKey: string;
  status: string;
}

@injectable()
export class ProjectService {
  public async createProject(
    userId: string,
    projectName: string,
    boardType: "ESP32" | "ESP8266",
  ): Promise<Project> {
    const user = await UserDAL.findUserByPublicId(userId);

    if (!user) {
      throw new ApiError("User not found!", StatusCodes.NOT_FOUND);
    }

    if (await ProjectDAL.isProjectNameInUse(user.getId(), projectName)) {
      throw new ApiError("Project with this name is already in use!", StatusCodes.CONFLICT);
    }

    const projectData = await ProjectDAL.createProject({
      userId: user.getId(),
      name: projectName,
      boardType: boardType,
    });

    return projectData;
  }

  public async findProjectByPublicId(id: string) {
    const project = await ProjectDAL.findProjectByPublicId(id);
    if (!project) throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);

    return project;
  }

  // TODO get all user projects with pagination......
  public async getAllProjects(userId: string): Promise<readonly ProjectDTOFields[]> {
    const user = await UserDAL.findUserByPublicId(userId);

    if (!user) {
      throw new ApiError("User not found!", StatusCodes.NOT_FOUND);
    }

    const projects = await ProjectDAL.findProjectsByUserId(user.id!);

    return projects.map((e, i) => {
      return {
        id: e.getPublicId(),
        projectName: e.getProjectName(),
        boardType: e.getBoardType(),
        totalReleases: e.Releases?.length,
        status: e.Releases?.at(0)?.getChannel(),
        apiKey: e.getApiKey(),
      };
    }) as ProjectDTOFields[];
  }

  public async softDeleteProject(projectId: string): Promise<void> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }

    const transaction = await db.transaction();
    try {
      await ReleaseDAL.deleteAllReleases(project.getId(), transaction);
      await ProjectDAL.deleteProject(project.getId(), transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
