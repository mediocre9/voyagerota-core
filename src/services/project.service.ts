import { db } from "@config/db.config";
import * as UserDAL from "@dal/user.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as OutBoxDAL from "@dal/outbox.dal";
import { Project } from "@models/project.model";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";
import { OutBoxEvent, OutBoxState } from "@models/outbox.model";

// ! [Bug]: file related operations inside db transactions can fail and may cause data inconsistencies
// ! [PRI-1]

// * Status: Open.
// * Issue #27
// * This issue is for Outbox just remember that....
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

  public async findProjectByPublicId(id: string) {
    const project = await ProjectDAL.findProjectByPublicId(id);
    if (!project) throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);

    return project;
  }

  public async softDeleteProject(projectId: string): Promise<void> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }

    const transaction = await db.transaction();
    try {
      const releases = await ReleaseDAL.findReleasesByProjectId(project.getId());

      for (const release of releases) {
        await ArtifactDAL.softDeleteArtifactByReleaseId(release.getId(), transaction);
      }

      await ReleaseDAL.softDeleteAllReleases(project.getId(), transaction);
      await ProjectDAL.softDeleteProject(project.getId(), transaction);
      await OutBoxDAL.createOutbox({
        projectId: project.getId(),
        event: OutBoxEvent.DELETE,
        state: OutBoxState.PENDING,
        transaction: transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async restoreProject(projectId: string): Promise<void> {
    const project = await ProjectDAL.findSoftDeletedProjectById(projectId);

    if (!project) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }

    const transaction = await db.transaction();
    try {
      await project.restore({ transaction: transaction });
      const releases = await ReleaseDAL.findSoftDeletedReleasesByProjectId(project.getId());

      for (const release of releases) {
        await release.restore({ transaction });
        const artifact = await ArtifactDAL.findSoftDeletedArtifactByReleaseId(release.getId());
        await artifact?.restore({ transaction: transaction });
      }

      await OutBoxDAL.createOutbox({
        projectId: project.getId(),
        event: OutBoxEvent.RESTORE,
        state: OutBoxState.PENDING,
        transaction: transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
