import "reflect-metadata";
import "@models/index";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { Logger } from "@utils/logger";
import { isDevEnvironment, isFastDormantTest } from "@config/config";
import { redis } from "@config/redis.connection.config";
import { EmailTemplate, getTemplate, IEmailContentData } from "@config/email.client";
import { EmailQueue } from "@queues/email.queue";
import { ProjectService } from "@services/project.service";
import { ArtifactReleaseService } from "@services/release.service";
import { CronJob } from "cron";
import { container } from "tsyringe";

type PurgeStatus = {
  removed: boolean;
  count: number;
};

const queue = new EmailQueue<IEmailContentData>();
const LOCK_KEY = "vygr:cron:purge-projects";

function _isDryRun(): boolean {
  return process.env.DORMANT_DRY_RUN === "true";
}

async function _purgeSoftDeletedProjects(): Promise<PurgeStatus> {
  const MAX_DAYS = 90; //  90 days = 3 months.....
  const MAX_DAYS_IN_MILLISECONDS = isFastDormantTest()
    ? new Date(Date.now() - 30 * 1000) // 30 seconds with DORMANT_FAST_TEST.....
    : isDevEnvironment()
      ? new Date(Date.now() - 10 * 60 * 1000) // 10 minutes older records.....
      : new Date(Date.now() - MAX_DAYS * 60 * 60 * 24 * 1000);

  const count = await ProjectDAL.purgeCleanedUpProjects(MAX_DAYS_IN_MILLISECONDS);
  return { count: count, removed: count > 0 };
}

// * the deadline was set when the first notice went out, deletion waits for the final one....
async function _purgeDormantProjects(now: Date): Promise<PurgeStatus> {
  const projects = await ProjectDAL.findProjectsDueForDeletion(now, 100);
  const service = container.resolve(ProjectService);

  let count = 0;
  for (const project of projects) {
    if (_isDryRun()) {
      Logger.info(`[dry run] would delete dormant project ${project.getPublicId()}`);
      continue;
    }

    await service.deleteDormantProject(project);
    await queue.enqueueEmail(
      {
        subject: `${project.getProjectName()} was deleted`,
        recipientEmail: project.User!.getEmail(),
        body: getTemplate(project.getProjectName(), EmailTemplate.PROJECT_DELETED),
      },
      `dormant-deleted-${project.getId()}`,
    );
    count++;
  }
  return { count: count, removed: count > 0 };
}

async function _purgeStaleReleases(now: Date): Promise<PurgeStatus> {
  const releases = await ReleaseDAL.findReleasesDueForDeletion(now, 100);
  const service = container.resolve(ArtifactReleaseService);

  let count = 0;
  for (const release of releases) {
    if (_isDryRun()) {
      Logger.info(`[dry run] would delete stale release ${release.getPublicId()}`);
      continue;
    }

    await service.removeRelease({ releaseId: release.getPublicId() });
    count++;
  }
  return { count: count, removed: count > 0 };
}

async function _safely(name: string, step: () => Promise<PurgeStatus>): Promise<PurgeStatus> {
  try {
    return await step();
  } catch (error) {
    Logger.error(`Purging ${name} failed: ${(error as Error).message}`);
    return { count: 0, removed: false };
  }
}

export async function runPurgeCron(now: Date = new Date()): Promise<void> {
  // * only one instance purges at a time....
  if ((await redis.set(LOCK_KEY, "1", "EX", 10 * 60, "NX")) !== "OK") {
    Logger.info("Purging cron already running elsewhere, skipped");
    return;
  }

  try {
    Logger.info("Purging cron job inititated!");

    // * each step on its own, one failing must not hold the others back....
    const softDeletedProjects = await _safely("soft deleted projects", _purgeSoftDeletedProjects);
    const dormantProjects = await _safely("dormant projects", () => _purgeDormantProjects(now));
    const staleReleases = await _safely("stale releases", () => _purgeStaleReleases(now));

    if (softDeletedProjects.removed) {
      Logger.info(`Purged soft deleted projects${softDeletedProjects.count} projects!`);
    }

    if (dormantProjects.removed) {
      Logger.info(`Purged dormant projects${dormantProjects.count} projects!`);
    }

    if (staleReleases.removed) {
      Logger.info(`Removed stale releases ${staleReleases.count}!`);
    }

    Logger.info("Purging cron job finished");
  } finally {
    await redis.del(LOCK_KEY);
  }
}

// *Runs daily at 12:00am......
// *for development 3 minutes, 5 seconds with DORMANT_FAST_TEST.....
const CRON_EXPRESSION = isFastDormantTest()
  ? "*/5 * * * * *"
  : isDevEnvironment()
    ? "*/180 * * * * *"
    : "0 0 0 * * *";

const PurgingCronJob = new CronJob(CRON_EXPRESSION, async () => {
  try {
    await runPurgeCron();
  } catch (error) {
    Logger.error((error as Error).message);
  }
});

PurgingCronJob.start();
