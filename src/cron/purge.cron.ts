import { db } from "@config/db.config";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import * as TelemetryDAL from "@dal/telemetry.dal";
import { Logger } from "@utils/logger";
import { isDevEnvironment } from "@utils/utils";
import { CronJob } from "cron";

// *Runs on weekends 2 times a day at 0:00 and 12:00......
const CRON_EXPRESSION = isDevEnvironment() ? "*/20 * * * * *" : "0 0 0,12 * * 6,0";

// Removes records completely that are 30 days old....
export const PurgeCronJob = new CronJob(CRON_EXPRESSION, async () => {
  Logger.info("Cron Job Fired!");

  const MAX_DAYS = 30;
  const MAX_DAYS_IN_MILLISECONDS = isDevEnvironment()
    ? new Date(Date.now() - 2 * 60 * 1000) // 2 min past.....
    : new Date(Date.now() - MAX_DAYS * 60 * 60 * 24 * 1000);

  const transaction = await db.transaction();
  try {
    const releases = await ReleaseDAL.getSoftDeletedReleases(MAX_DAYS_IN_MILLISECONDS);
    if (releases.length > 0) {
      await ReleaseDAL.purgeAllReleases(MAX_DAYS_IN_MILLISECONDS, transaction);
      Logger.info("Releases have been purged!");
    }

    const telemetries = await TelemetryDAL.getSoftDeletedTelemetry(MAX_DAYS_IN_MILLISECONDS);
    if (telemetries.length > 0) {
      await TelemetryDAL.purgeAllTelemetry(MAX_DAYS_IN_MILLISECONDS, transaction);
      Logger.info("Telemtry has been purged!");
    }

    const projects = await ProjectDAL.getSoftDeletedProjects(MAX_DAYS_IN_MILLISECONDS);
    if (projects.length > 0) {
      await ProjectDAL.purgeAllProjects(MAX_DAYS_IN_MILLISECONDS, transaction);
      Logger.info("Projects have been purged!");
    }
    await transaction.commit();

    Logger.info("Cron Job Finished!");
  } catch (error) {
    await transaction.rollback();
    Logger.error(error as string);
  }
});
