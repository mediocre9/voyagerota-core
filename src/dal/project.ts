import { Project } from "@models/project";
import { generateApiKey } from "@utils/utils";
import { Board, Nullable } from "types";

export type ProjectData = {
  userId: string;
  name: string;
  boardType: Board;
};

export async function createProject(data: ProjectData): Promise<Readonly<Project>> {
  const { userId, name, boardType } = data;

  return await Project.create({
    user_id_fk: userId,
    project_name: name,
    board_type: boardType,
  });
}

export async function rotateProjectApiKey(projectId: string): Promise<void> {
  const apiKey = generateApiKey();
  await Project.update({ api_key: apiKey }, { where: { project_id: projectId } });
}

export async function isProjectNameInUse(
  userId: string,
  name: string
): Promise<Readonly<Nullable<Project>>> {
  return await Project.findOne({
    attributes: { exclude: ["id"] },
    where: { user_id_fk: userId, project_name: name },
  });
}

export async function findProjectsByUserId(userId: string): Promise<Readonly<Project>[]> {
  return await Project.findAll({
    attributes: { exclude: ["id"] },
    where: { user_id_fk: userId },
  });
}

export async function findProjectByPublicId(
  publicID: string
): Promise<Readonly<Nullable<Project>>> {
  return await Project.findOne({
    where: { project_id: publicID },
  });
}
