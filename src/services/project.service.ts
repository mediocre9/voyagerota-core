import { db } from "@config/db.config";
import * as UserDAL from "@dal/user.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as OutBoxDAL from "@dal/outbox.dal";
import { Project } from "@models/project.model";
import { User } from "@models/user.model";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";
import { RolloutSettings, rolloutSettings } from "./device.service";
import { OutBoxEvent, OutBoxState } from "@models/outbox.model";
import { readKeepToken } from "@utils/keep.token";
import * as PlanService from "./plan.service";

export interface ProjectDTOFields {
  id: string;
  projectName: string;
  boardType: string;
  totalReleases: number;
  apiKey: string;
  status: string;
  settings: RolloutSettings;
  deletionScheduledAt: Date | null;
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

    await PlanService.assertCanCreateProject(user);

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
        settings: rolloutSettings(e),
        deletionScheduledAt: e.getDataValue("deletion_scheduled_at") ?? null,
      };
    }) as ProjectDTOFields[];
  }

  public async findProjectByPublicId(id: string) {
    const project = await ProjectDAL.findProjectByPublicId(id);
    if (!project) throw new ApiError("Project not found!", StatusCodes.NOT_FOUND);

    return project;
  }

  public async softDeleteProject(projectId: string, owner: User): Promise<void> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);

    if (!project || project.getUserForeignKey() !== owner.getId()) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }

    await this._softDeleteWithFiles(project);
  }

  // dormant projects go the same way as a user delete, so their files are cleaned up too....
  public async deleteDormantProject(project: Project): Promise<void> {
    await this._softDeleteWithFiles(project);
  }

  public async keepProject(projectId: string, owner: User): Promise<void> {
    const project = await ProjectDAL.findProjectByPublicId(projectId);
    if (!project || project.getUserForeignKey() !== owner.getId()) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }
    await ProjectDAL.clearDormantSchedule(project.getId());
  }

  // from the email link, works without signing in while that deadline still stands....
  public async keepProjectByToken(token: string): Promise<string> {
    const data = readKeepToken(token);
    const project = data ? await ProjectDAL.findProjectByPublicId(data.projectId) : null;
    const scheduledAt = project?.getDataValue("deletion_scheduled_at");
    const sameDeadline = Boolean(
      data &&
      scheduledAt &&
      Math.floor(scheduledAt.getTime() / 1000) === Math.floor(data.scheduledAt / 1000),
    );
    if (!data || !project || !sameDeadline) {
      throw new ApiError("This link has expired or was already used.", StatusCodes.GONE);
    }
    await ProjectDAL.clearDormantSchedule(project.getId());
    return project.getProjectName();
  }

  private async _softDeleteWithFiles(project: Project): Promise<void> {
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

  public async restoreProject(projectId: string, owner: User): Promise<void> {
    const project = await ProjectDAL.findSoftDeletedProjectById(projectId);

    if (!project || project.getUserForeignKey() !== owner.getId()) {
      throw new ApiError("Project not found", StatusCodes.NOT_FOUND);
    }

    await PlanService.assertCanCreateProject(owner);

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
