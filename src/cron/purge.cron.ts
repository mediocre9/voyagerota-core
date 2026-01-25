import { db } from "@config/db.config";
import * as ReleaseDAL from "@dal/release.dal";
import * as ArtifactDAL from "@dal/artifact.dal";
import { Logger } from "@utils/logger";
import { isDevEnvironment } from "@config/config";
import { CronJob } from "cron";
import { FileStorageOperation } from "@utils/common";

// *Runs on weekends 2 times a day at 12:00am......
// *for development 3 minutes.....
const CRON_EXPRESSION = isDevEnvironment() ? "*/180 * * * * *" : "0 0 0 * * 6,0";

// Removes records completely that are 30 days old....
export const PurgingCronJob = new CronJob(CRON_EXPRESSION, async () => {
  Logger.info("Cron Job Fired!");

  const MAX_DAYS = 30;
  const MAX_DAYS_IN_MILLISECONDS = isDevEnvironment()
    ? new Date(Date.now() - 10 * 60 * 1000) // 10 minutes older records.....
    : new Date(Date.now() - MAX_DAYS * 60 * 60 * 24 * 1000);

  const transaction = await db.transaction();
  try {
    const releases = await ReleaseDAL.getSoftDeletedReleases(MAX_DAYS_IN_MILLISECONDS);
    const artifacts = await ArtifactDAL.getSoftDeletedArtifacts(MAX_DAYS_IN_MILLISECONDS);

    if (releases.length > 0) {
      for (const artifact of artifacts) {
        await FileStorageOperation.removePermanently(artifact.filename!);
      }

      await ArtifactDAL.purgeAllArtifacts(MAX_DAYS_IN_MILLISECONDS, transaction);
      await ReleaseDAL.purgeAllReleases(MAX_DAYS_IN_MILLISECONDS, transaction);
      Logger.info("Releases have been purged!");
    }
    await transaction.commit();

    Logger.info("Cron Job Finished!");
  } catch (error) {
    await transaction.rollback();
    Logger.error(error as string);
  }
});
