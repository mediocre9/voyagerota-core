import { EmailTemplate, getTemplate, SystemStatusEmailAlert } from "@config/email.client";
import { EmailQueue } from "@queues/email.queue";
import { Logger } from "@utils/logger";
import { CronJob } from "cron";
import InMemoryCacheStore from "node-cache";
import * as child_process from "node:child_process";
import * as os from "node:os";
import * as util from "node:util";

const exec = util.promisify(child_process.exec);

enum ExternalService {
  MYSQL = "mysql",
  REDIS = "redis",
}

type SystemCTLProcessStatus = "active" | "inactive" | "failed" | "activating" | "error";

async function _runServiceStatusCheck(service: ExternalService) {
  try {
    const { stdout } = await exec(`systemctl is-active ${service}`);
    return { serviceName: service, status: stdout.trim() as SystemCTLProcessStatus };
  } catch (error) {
    Logger.error(error as string);
  }

  return { serviceName: service, status: "error" as SystemCTLProcessStatus };
}

// * let the service restart synchronously.....before doing anything....
// * a non root user restarts through a narrow sudoers rule set up by deploy/setup.sh....
function _restartService(service: ExternalService): void {
  try {
    const sudo = process.getuid?.() === 0 ? "" : "sudo -n ";
    child_process.execSync(`${sudo}systemctl restart ${service}`);
  } catch (error) {
    Logger.error(error as string);
  }
}

const emailQueue = new EmailQueue<SystemStatusEmailAlert>();

async function _sendAlert({
  serviceName,
  statusTemplate,
  subject,
}: {
  subject: string;
  statusTemplate: EmailTemplate;
  serviceName: ExternalService;
}) {
  await emailQueue.enqueueEmail({
    subject: subject,
    body: getTemplate(serviceName, statusTemplate),
    recipientEmail: process.env.BREVO_SMTP_RECEPIENT_DEV_EMAIL,
  });
}

const MAX_RETRIES = 5;
const TTL = 6 * 3600; // 6hrs......
const cache = new InMemoryCacheStore({ stdTTL: TTL, deleteOnExpire: true });
async function _systemCTLProcessStatusCheckerCron(): Promise<void> {
  Logger.info("SystemCTL Alert Cron job inititated!");
  const services = [ExternalService.MYSQL, ExternalService.REDIS];

  let retryCounter = 0;
  for (let i = 0; i < services.length; i++) {
    retryCounter = 0;
    const { serviceName, status } = await _runServiceStatusCheck(services[i]);
    if (status === "active" || status === "activating") {
      continue;
    }

    for (let j = 0; j < MAX_RETRIES; j++) {
      _restartService(serviceName);
      const service = await _runServiceStatusCheck(serviceName);

      if (service.status !== "active") {
        ++retryCounter;
        Logger.warn(`Attempt ${retryCounter} failed. Retrying . . . .`);
      } else {
        Logger.info(`Service: ${serviceName} restarted successfully!`);
        cache.del(serviceName);
        retryCounter = 0;
        await _sendAlert({
          serviceName: serviceName,
          statusTemplate: EmailTemplate.PROCESS_RESTART_SUCCESSFUL,
          subject: `Alert: ${serviceName.toUpperCase()} restarted successfully!`,
        });
        break;
      }
    }

    if (retryCounter >= MAX_RETRIES && !cache.has(serviceName)) {
      retryCounter = 0;
      await _sendAlert({
        serviceName: serviceName,
        statusTemplate: EmailTemplate.PROCESS_RESTART_FAILED,
        subject: "Alert: Manual Intervention Required!",
      });
      cache.set(serviceName, "dispatched");
    }
  }
  Logger.info("SystemCTL Alert Cron job finished!");
}

const CRON_EXPRESSION = "0 */15 * * * *"; // every 15mins........
if (os.platform() !== "linux") {
  Logger.warn(`This cron job is only supported for LINUX based environments.....`);
} else {
  const cron = new CronJob(CRON_EXPRESSION, _systemCTLProcessStatusCheckerCron);
  cron.start();
}
