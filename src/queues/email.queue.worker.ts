import { Job, Worker as EmailWorker } from "bullmq";
import { EMAIL_QUEUE_NAME, EmailQueue } from "./email.queue";
import { Logger } from "@utils/logger";
import { redis, redis as RedisConnection } from "@config/redis.connection.config";
import { isDevEnvironment } from "@config/config";
import { getNextDayTimeDifference } from "@utils/utils";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import {
  sendEmail,
  IEmailContentData,
  DormantProjectEmailAlert,
  StaleReleaseEmailAlert,
  SystemStatusEmailAlert,
  getBrevoSMTPDailyQuota,
} from "@config/email.client";

type EmailAlertContentData =
  | DormantProjectEmailAlert
  | StaleReleaseEmailAlert
  | SystemStatusEmailAlert;

const BREVO_QUOTA_CHECK_KEY = "brevo-quota-check-key";
const BREVO_QUOTA_CHECK_DATA = "checked";

async function _isQuotaRecentlyChecked(): Promise<boolean> {
  return (await redis.get(BREVO_QUOTA_CHECK_KEY)) !== null;
}

async function _cacheRecentlyCheckedQuota(): Promise<void> {
  await redis.setex(BREVO_QUOTA_CHECK_KEY, 15 * 60, BREVO_QUOTA_CHECK_DATA); // 15m expiration.....
}

async function _invalidateQuotaCheckedCache(): Promise<void> {
  await redis.del(BREVO_QUOTA_CHECK_KEY);
}

const emailQueue = new EmailQueue();

const worker = new EmailWorker(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailAlertContentData>): Promise<void> => {
    if (!isDevEnvironment()) {
      const isQuotaRecentlyChecked = await _isQuotaRecentlyChecked();

      if (!isQuotaRecentlyChecked) {
        const { remainingQuota, isDailyFreeQuotaLow } = await getBrevoSMTPDailyQuota();
        Logger.info(`Brevo remaining quota: ${remainingQuota}`);

        await _cacheRecentlyCheckedQuota();

        if (isDailyFreeQuotaLow) {
          const rateLimitDuration = getNextDayTimeDifference();
          Logger.warn(`Email worker ratelimited with duration of ${rateLimitDuration}`);

          await _invalidateQuotaCheckedCache();
          await emailQueue.rateLimit(rateLimitDuration);
          throw EmailWorker.RateLimitError();
        }
      }
    }

    try {
      if (!isDevEnvironment()) {
        await sendEmail(job.data);
      }

      if ("projectId" in job.data) {
        await ProjectDAL.updateProjectSuspendStatus(job.data.projectId, true);

        // the deadline only counts once the user was actually told....
        if (job.data.notice && job.data.scheduledAt) {
          await ProjectDAL.scheduleDormantDeletion(
            job.data.projectId,
            job.data.notice,
            new Date(job.data.scheduledAt),
          );
        }
      }

      if ("releaseNotices" in job.data) {
        for (const { releaseId, notice, scheduledAt } of job.data.releaseNotices) {
          await ReleaseDAL.updateStaleNotice(
            releaseId,
            notice,
            scheduledAt ? new Date(scheduledAt) : null,
          );
        }
      }

      Logger.info(`Email Message : ${job.data.recipientEmail} - ${job.data.subject}`);
    } catch (error) {
      Logger.error((error as Error).message);
      throw error;
    }
  },
  {
    limiter: {
      max: 15,
      duration: 15 * 60 * 1000, // 15m in ms.....
    },
    connection: RedisConnection,
    autorun: true,
    removeOnComplete: {
      age: 24 * 3600,
      count: 300,
    },
    removeOnFail: {
      age: 24 * 3600,
      count: 600,
    },
  },
);

worker.on("ready", () => {
  Logger.info("email worker started!");
});

worker.on("active", (job: Job<IEmailContentData>, _) => {
  Logger.info(`Attempt: ${job.attemptsMade} - job: ${job.id} is being processed!`);
});

worker.on("error", (error) => {
  Logger.error(error.message);
});

worker.on("failed", (_, error) => {
  Logger.error(error.message);
});

worker.on("completed", (job: Job<IEmailContentData>, _) => {
  Logger.info(`Sent email: ${job.data.recipientEmail}`);
});
