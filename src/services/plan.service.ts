import { ACTIVE_DEVICE_DAYS, DEVICE_PACK_SIZE, PlanLimits, PlanName, PLANS } from "@config/plans";
import * as DeviceDAL from "@dal/project.device.dal";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import * as UserDAL from "@dal/user.dal";
import { Project } from "@models/project.model";
import { User } from "@models/user.model";
import { ApiError, PlanLimitError } from "@utils/error";
import { StatusCodes } from "http-status-codes";

export type AccountPlan = {
  name: PlanName;
  paidPlan: PlanName;
  isTrial: boolean;
  trialEndsAt: Date | null;
  devicePacks: number;
  limits: PlanLimits;
};

export type AccountUsage = {
  projects: number;
  devices: number;
  activeDevices: number;
  waitingDevices: number;
};

// a running trial lifts a maker account to pro, a paid plan always wins....
export function getAccountPlan(user: User, now: Date = new Date()): AccountPlan {
  const paidPlan = user.getPlan();
  const trialEndsAt = user.getTrialEndsAt();
  const isTrial = paidPlan === "maker" && !!trialEndsAt && trialEndsAt.getTime() > now.getTime();
  const name: PlanName = isTrial ? "pro" : paidPlan;
  const devicePacks = name === "pro" ? user.getDevicePacks() : 0;

  return {
    name,
    paidPlan,
    isTrial,
    trialEndsAt,
    devicePacks,
    limits: { ...PLANS[name], devices: PLANS[name].devices + devicePacks * DEVICE_PACK_SIZE },
  };
}

export async function getAccountUsage(user: User, now: Date = new Date()): Promise<AccountUsage> {
  const activeSince = new Date(now.getTime() - ACTIVE_DEVICE_DAYS * 24 * 60 * 60 * 1000);
  const [projects, devices] = await Promise.all([
    ProjectDAL.countProjectsByUserId(user.getId()),
    DeviceDAL.countAccountDevices(user.getId(), activeSince),
  ]);

  return {
    projects,
    devices: devices.active + devices.waiting,
    activeDevices: devices.active,
    waitingDevices: devices.waiting,
  };
}

export async function getProjectOwner(project: Project): Promise<User> {
  const owner = project.User ?? (await UserDAL.findUserById(project.getUserForeignKey()));
  if (!owner) throw new ApiError("Project owner not found!", StatusCodes.NOT_FOUND);
  return owner;
}

export async function getProjectPlan(project: Project): Promise<AccountPlan> {
  return getAccountPlan(await getProjectOwner(project));
}

function _upgradeHint(plan: AccountPlan): string {
  return plan.name === "pro"
    ? "Contact support for a higher limit."
    : "Upgrade your plan to add more.";
}

export async function assertCanCreateProject(user: User): Promise<void> {
  const plan = getAccountPlan(user);
  const usage = await getAccountUsage(user);
  if (usage.projects >= plan.limits.projects) {
    throw new PlanLimitError(
      `Your plan allows ${plan.limits.projects} project(s). ${_upgradeHint(plan)}`,
      "projects",
    );
  }
}

export async function assertCanCreateRelease(project: Project): Promise<void> {
  const plan = await getProjectPlan(project);
  const releases = await ReleaseDAL.countReleases(project.getId(), "all");
  if (releases >= plan.limits.releasesPerProject) {
    throw new PlanLimitError(
      `Your plan allows ${plan.limits.releasesPerProject} releases per project. Delete an old release or upgrade your plan.`,
      "releases",
    );
  }
}

// approving turns a waiting device into an active one, so only active devices are checked....
export async function assertCanApproveDevice(project: Project): Promise<void> {
  const owner = await getProjectOwner(project);
  const plan = getAccountPlan(owner);
  const usage = await getAccountUsage(owner);
  if (usage.activeDevices >= plan.limits.devices) {
    throw new PlanLimitError(
      `Your plan allows ${plan.limits.devices} active devices. ${_upgradeHint(plan)}`,
      "devices",
    );
  }
}

// adding from the dashboard creates an active device straight away....
export async function assertCanPreAddDevice(project: Project): Promise<void> {
  const plan = await getProjectPlan(project);
  if (!plan.limits.preAddDevices) {
    throw new PlanLimitError(
      "Adding devices by hardware ID is available on Standard and Pro.",
      "preAddDevices",
    );
  }
  await assertCanApproveDevice(project);
}

// new devices may wait for approval up to the plan's device count per project....
export async function canQueueWaitingDevice(project: Project): Promise<boolean> {
  const plan = await getProjectPlan(project);
  const waiting = await DeviceDAL.countWaitingByProject(project.getId());
  return waiting < plan.limits.devices;
}

export async function assertCanAutoRevoke(project: Project): Promise<void> {
  const plan = await getProjectPlan(project);
  if (!plan.limits.autoRevoke) {
    throw new PlanLimitError("Auto-revoke is available on Pro.", "autoRevoke");
  }
}
