import * as ProjectDAL from "@dal/project.dal";
import { Logger } from "@utils/logger";
import { isDevEnvironment } from "@config/config";
import { CronJob } from "cron";

// *Runs on saturday 2 times a day at 12:00am and 3:00am......
// *for development 3 minutes.....
const CRON_EXPRESSION = isDevEnvironment() ? "*/180 * * * * *" : "0 0 0,3 * * 6";

// Removes records completely that are 3 months old....
const PurgingCronJob = new CronJob(CRON_EXPRESSION, async () => {
  Logger.info("Purging cron job inititated!");

  const MAX_DAYS = 90; //  90 days = 3 months.....
  const MAX_DAYS_IN_MILLISECONDS = isDevEnvironment()
    ? new Date(Date.now() - 10 * 60 * 1000) // 10 minutes older records.....
    : new Date(Date.now() - MAX_DAYS * 60 * 60 * 24 * 1000);

  const noOfDeletedProjects = await ProjectDAL.purgeAllProjects(MAX_DAYS_IN_MILLISECONDS);

  const purged = noOfDeletedProjects > 0;
  if (purged) {
    Logger.info(`Purged ${noOfDeletedProjects} projects!`);
  }

  Logger.info("Purging cron job finished");
});

PurgingCronJob.start();
