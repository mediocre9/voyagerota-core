export type PlanName = "maker" | "standard" | "pro";

export type PlanLimits = {
  projects: number;
  devices: number;
  releasesPerProject: number;
  historyPerDevice: number;
  emailAlerts: boolean;
  autoRevoke: boolean;
  preAddDevices: boolean;
};

export const PLANS: Record<PlanName, PlanLimits> = {
  maker: {
    projects: 1,
    devices: 5,
    releasesPerProject: 10,
    historyPerDevice: 10,
    emailAlerts: false,
    autoRevoke: false,
    preAddDevices: false,
  },
  standard: {
    projects: 3,
    devices: 25,
    releasesPerProject: 50,
    historyPerDevice: 30,
    emailAlerts: true,
    autoRevoke: false,
    preAddDevices: true,
  },
  pro: {
    projects: 10,
    devices: 150,
    releasesPerProject: 300,
    historyPerDevice: 100,
    emailAlerts: true,
    autoRevoke: true,
    preAddDevices: true,
  },
};

export const PLAN_NAMES = Object.keys(PLANS) as PlanName[];

export const TRIAL_DAYS = 14;

// extra device packs, pro only....
export const DEVICE_PACK_SIZE = 50;

// a device that hasn't checked in for this long stops counting against the plan....
export const ACTIVE_DEVICE_DAYS = 30;

// fair use, the same on every plan....
export const CHECK_IN_INTERVAL_SECONDS = 30;
export const PROJECT_REQUESTS_PER_MINUTE = 300;

export function isPlanName(value: string): value is PlanName {
  return (PLAN_NAMES as string[]).includes(value);
}
