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
