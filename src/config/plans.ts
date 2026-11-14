export type PlanName = "free" | "pro";

export type PlanLimits = {
  projects: number;
  devices: number;
  releasesPerProject: number;
  historyPerDevice: number;
  emailAlerts: boolean;
  autoRevoke: boolean;
  preAddDevices: boolean;
};

// generous where it costs little (releases, history), small where it costs the server (devices)....
export const PLANS: Record<PlanName, PlanLimits> = {
  free: {
    projects: 1,
    devices: 5,
    releasesPerProject: 25,
    historyPerDevice: 20,
    emailAlerts: false,
    autoRevoke: false,
    preAddDevices: false,
  },
  pro: {
    projects: 3,
    devices: 50,
    releasesPerProject: 150,
    historyPerDevice: 100,
    emailAlerts: true,
    autoRevoke: true,
    preAddDevices: true,
  },
};

export const PLAN_NAMES = Object.keys(PLANS) as PlanName[];

export const TRIAL_DAYS = 14;

// a device that hasn't checked in for this long stops counting against the plan....
export const ACTIVE_DEVICE_DAYS = 30;

// fair use, the same on every plan....
export const CHECK_IN_INTERVAL_SECONDS = 30;
export const PROJECT_REQUESTS_PER_MINUTE = 300;

export function isPlanName(value: string): value is PlanName {
  return (PLAN_NAMES as string[]).includes(value);
}
