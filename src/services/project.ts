import * as ProjectDAL from "@dal/project";
import * as UserDAL from "@dal/auth";
import { Project } from "@models/project";
import { ProjectDTO } from "types";
import { injectable } from "tsyringe";

/**
 * @todo Incomplete Service....
 */
@injectable()
export class ProjectService {
  async createProject(userId: string, project: ProjectDTO): Promise<void> {
    const { projectName, boardType } = project;

    const user = await UserDAL.findUserByPublicId(userId);

    if (!user) {
      throw new Error("User not found!");
    }

    if (await ProjectDAL.isProjectNameInUse(user.id!, projectName)) {
      throw new Error("Project with this name already in use!");
    }

    await ProjectDAL.createProject({
      userId: user.id!,
      name: projectName,
      boardType: boardType,
    });
  }

  async getProjects(userId: string): Promise<Readonly<Project>[]> {
    const user = await UserDAL.findUserByPublicId(userId);

    if (!user) {
      throw new Error("User not found!");
    }

    return await ProjectDAL.findProjectsByUserId(user.id!);
  }

  async regenerateProjectApiKey(projectId: string): Promise<void> {
    await ProjectDAL.rotateProjectApiKey(projectId);
  }
}
