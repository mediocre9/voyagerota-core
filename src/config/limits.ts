// one free service, the same limits for every account....
export const LIMITS = {
  projects: 3,
  devicesPerProject: 5,
  releasesPerProject: 40,
  historyPerDevice: 25,
} as const;

export type Limits = typeof LIMITS;

// a device that hasn't checked in for this long stops counting against the limit....
export const ACTIVE_DEVICE_DAYS = 30;

// fair use, one check-in per device and a request budget per project....
export const CHECK_IN_INTERVAL_SECONDS = 30;
export const PROJECT_REQUESTS_PER_MINUTE = 300;

// a deleted project can be restored for this long, then it is purged for good....
// 0 (the default) deletes it for good right away and turns restoring off....
export const DELETED_PROJECT_DAYS = Math.max(0, Number(process.env.PROJECT_RESTORE_DAYS) || 0);

export function isRestoreEnabled(): boolean {
  return DELETED_PROJECT_DAYS > 0;
}

// re-signing in within this window is required to delete a project that reaches real boards....
export const DELETE_REVERIFICATION = { level: "first_factor", afterMinutes: 10 } as const;
