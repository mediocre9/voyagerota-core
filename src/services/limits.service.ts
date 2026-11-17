import { ACTIVE_DEVICE_DAYS, LIMITS } from "@config/limits";
import * as DeviceDAL from "@dal/project.device.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { Project } from "@models/project.model";
import { User } from "@models/user.model";
import { LimitError } from "@utils/error";

export type AccountUsage = {
  projects: number;
  devices: number;
  activeDevices: number;
  waitingDevices: number;
};

export async function getAccountUsage(
  userId: number,
  now: Date = new Date(),
): Promise<AccountUsage> {
  const activeSince = new Date(now.getTime() - ACTIVE_DEVICE_DAYS * 24 * 60 * 60 * 1000);
  const [projects, devices] = await Promise.all([
    ProjectDAL.countProjectsByUserId(userId),
    DeviceDAL.countAccountDevices(userId, activeSince),
  ]);

  return {
    projects,
    devices: devices.active + devices.waiting,
    activeDevices: devices.active,
    waitingDevices: devices.waiting,
  };
}

export async function assertCanCreateProject(user: User): Promise<void> {
  const usage = await getAccountUsage(user.getId());
  if (usage.projects >= LIMITS.projects) {
    throw new LimitError(
      `You can have up to ${LIMITS.projects} projects. Delete one you no longer use.`,
      "projects",
    );
  }
}

export async function assertCanCreateRelease(project: Project): Promise<void> {
  const releases = await ReleaseDAL.countReleases(project.getId(), "all");
  if (releases >= LIMITS.releasesPerProject) {
    throw new LimitError(
      `A project can have up to ${LIMITS.releasesPerProject} releases. Delete an old release first.`,
      "releases",
    );
  }
}

// approving turns a waiting device into an active one, so only active devices are checked....
export async function assertCanApproveDevice(project: Project): Promise<void> {
  const usage = await getAccountUsage(project.getUserForeignKey());
  if (usage.activeDevices >= LIMITS.devices) {
    throw new LimitError(
      `You can have up to ${LIMITS.devices} devices. Remove one you no longer use first.`,
      "devices",
    );
  }
}

// new devices may wait for approval up to the device limit per project....
export async function canQueueWaitingDevice(project: Project): Promise<boolean> {
  const waiting = await DeviceDAL.countWaitingByProject(project.getId());
  return waiting < LIMITS.devices;
}
