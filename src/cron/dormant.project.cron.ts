import { CronJob } from "cron";
import "@models/index";
import * as ProjectDAL from "@dal/project.dal";
import { EmailQueue } from "@queues/email.queue";
import { isDevEnvironment } from "@config/config";
import { DormantProjectEmailAlert, EmailTemplate, getTemplate } from "@config/email.client";
import { ReleaseChannel } from "@models/release.model";
import { Logger } from "@utils/logger";

const queue = new EmailQueue<DormantProjectEmailAlert>();

type NonProductionChannel = Extract<ReleaseChannel, "draft" | "staging">;

function _getEmailTemplateType(channel: NonProductionChannel): EmailTemplate {
  return channel === "draft" ? EmailTemplate.DRAFT_RELEASE : EmailTemplate.STAGING_RELEASE;
}

function _getScheduledDeletionDate(lastActitity: Date): string {
  const MAX_DAYS_IN_MILLISECONDS = 604800000; // 7days....
  return new Date(new Date(lastActitity).getTime() + MAX_DAYS_IN_MILLISECONDS).toDateString();
}

// * Runs daily at 12:00am....
// * for development 5 minutes....
const CRON_EXPRESSION = isDevEnvironment() ? "*/300 * * * * *" : "0 0 0 * * *";

const dormantProjectCron = new CronJob(CRON_EXPRESSION, async (): Promise<void> => {
  const MAX_DAYS = 30;
  const DURATION_IN_MILLISECONDS = isDevEnvironment()
    ? new Date(Date.now() - 60 * 60 * 1000) // 1 hour old dormant projects.....
    : new Date(Date.now() - MAX_DAYS * 60 * 60 * 24 * 1000); // 30 days old dormant projects....

  const projects = await ProjectDAL.findDormantProjects(150, DURATION_IN_MILLISECONDS);
  for (const project of projects) {
    if (project.hasNoReleases()) {
      const template = getTemplate(project.getProjectName(), EmailTemplate.DRAFT_RELEASE);
      const scheduledDate = _getScheduledDeletionDate(project.last_activity!);
      await queue.enqueueEmail({
        subject: `Action needed: project deletion scheduled on ${scheduledDate}`,
        projectId: project.getId(),
        recipientEmail: project.User!.getEmail(),
        body: template,
      });
      Logger.info(`Enqueued dormant project for email ${project.getPublicId()}`);
      continue;
    }

    if (project.hasReleases() && project.isInitialReleaseNonProduction()) {
      const channel = project.getInitialReleaseChannel();
      const emailTemplateType = _getEmailTemplateType(channel as NonProductionChannel);
      const template = getTemplate(project.getProjectName(), emailTemplateType);
      const scheduledDate = _getScheduledDeletionDate(project.last_activity!);
      await queue.enqueueEmail({
        subject: `Action needed: project deletion scheduled on ${scheduledDate}`,
        projectId: project.getId(),
        recipientEmail: project.User!.getEmail(),
        body: template,
      });
      Logger.info(`Enqueued dormant project for email ${project.getPublicId()}`);
    }
  }
});

dormantProjectCron.start();
