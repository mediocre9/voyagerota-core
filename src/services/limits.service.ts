import { ACTIVE_DEVICE_DAYS, LIMITS } from "@config/limits";
import * as DeviceDAL from "@dal/project.device.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { Project } from "@models/project.model";
import { User } from "@models/user.model";
import { LimitError } from "@utils/error";

export type DeviceCount = { active: number; waiting: number };

export type AccountUsage = {
  projects: number;
  devices: Record<string, DeviceCount>;
};

function _activeSince(now: Date = new Date()): Date {
  return new Date(now.getTime() - ACTIVE_DEVICE_DAYS * 24 * 60 * 60 * 1000);
}

// projects used, and the devices of each project keyed by its public id....
export async function getAccountUsage(userId: number): Promise<AccountUsage> {
  const projects = await ProjectDAL.findProjectIdsByUserId(userId);
  const since = _activeSince();
  const counts = await Promise.all(
    projects.map((project) => DeviceDAL.countProjectDevices(project.getId(), since)),
  );

  return {
    projects: projects.length,
    devices: Object.fromEntries(
      projects.map((project, index) => [project.getPublicId(), counts[index]]),
    ),
  };
}

export async function assertCanCreateProject(user: User): Promise<void> {
  const projects = await ProjectDAL.countProjectsByUserId(user.getId());
  if (projects >= LIMITS.projects) {
    throw new LimitError(
      `Limit reached: ${LIMITS.projects} projects. Delete one to create another.`,
      "projects",
    );
  }
}

export async function assertCanCreateRelease(project: Project): Promise<void> {
  const releases = await ReleaseDAL.countReleases(project.getId(), "all");
  if (releases >= LIMITS.releasesPerProject) {
    throw new LimitError(
      `Limit reached: ${LIMITS.releasesPerProject} releases per project. Delete an old one first.`,
      "releases",
    );
  }
}

// approving turns a waiting device into an active one, so only active devices are checked....
export async function assertCanApproveDevice(project: Project): Promise<void> {
  const { active } = await DeviceDAL.countProjectDevices(project.getId(), _activeSince());
  if (active >= LIMITS.devicesPerProject) {
    throw new LimitError(
      `Limit reached: ${LIMITS.devicesPerProject} devices per project. Remove one first.`,
      "devices",
    );
  }
}

// new devices may wait for approval up to the device limit per project....
export async function canQueueWaitingDevice(project: Project): Promise<boolean> {
  const waiting = await DeviceDAL.countWaitingByProject(project.getId());
  return waiting < LIMITS.devicesPerProject;
}
