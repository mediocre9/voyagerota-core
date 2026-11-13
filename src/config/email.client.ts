import { BrevoClient } from "@getbrevo/brevo";
import type { DormantNotice } from "@models/project.model";

export enum EmailTemplate {
  NO_RELEASE = "no-release-notice",
  DRAFT_RELEASE = "draft-release-notice",
  STAGING_RELEASE = "staging-release-notice",
  PROCESS_RESTART_FAILED = "processs-restart-failed",
  PROCESS_RESTART_SUCCESSFUL = "processs-restart-successful",
  PROJECT_DELETED = "project-deleted-notice",
}

export type TemplateOptions = { scheduledDate?: string; keepUrl?: string };

export function getTemplate(
  data: string,
  type: EmailTemplate,
  options: TemplateOptions = {},
): string {
  const deadline = options.scheduledDate
    ? `on <strong>${options.scheduledDate}</strong>`
    : "in <strong>7 days</strong>";
  const keep = options.keepUrl ? `<p><a href="${options.keepUrl}">Keep this project</a></p>` : "";

  const messages = {
    "no-release-notice": `<p>Your project <strong>${data}</strong> is scheduled for permanent deletion ${deadline}.</p>
    <p>To prevent deletion, simply create your first release. This will cancel the scheduled deletion and keep your project active.</p>
    <p>Projects whose initial release has already been deployed to Production do not receive these deletion notices.</p>${keep}`,

    "draft-release-notice": `<p>Your project <strong>${data}</strong> is scheduled for permanent deletion ${deadline}.</p>
    <p>Your initial release is currently in <strong>Draft</strong> status and has been inactive for an extended period. To prevent deletion, any operational activity on the release will cancel the scheduled deletion and keep your project active.</p>
    <p>Projects whose initial release has already been deployed to Production do not receive these deletion notices.</p>${keep}`,

    "staging-release-notice": `<p>Your project <strong>${data}</strong> is scheduled for permanent deletion ${deadline}.</p>
    <p>Your initial release is currently in <strong>Staging</strong> status and has been inactive for an extended period. To prevent deletion, any operational activity on the release will cancel the scheduled deletion and keep your project active.</p>
    <p>Projects whose initial release has already been deployed to Production do not receive these deletion notices.</p>${keep}`,

    "processs-restart-failed": `${data} service is down. Manual Restart and inspection is required!`,
    "processs-restart-successful": `${data} service restarted successfully.`,
    "project-deleted-notice": `<p>Your project <strong>${data}</strong> was deleted after a long time without activity.</p>
    <p>Reply to this email within 90 days if you want it back.</p>`,
  };

  return messages[type];
}

export type ReleaseDigestItem = {
  projectName: string;
  version: string;
  channel: string;
  deletesOn: string | null;
};

export function getReleaseDigestTemplate(items: ReleaseDigestItem[]): string {
  const rows = items
    .map(
      (item) =>
        `<li><strong>${item.projectName}</strong> v${item.version} (${item.channel}): ${
          item.deletesOn
            ? `will be deleted on <strong>${item.deletesOn}</strong>`
            : "has been waiting a long time to be promoted"
        }</li>`,
    )
    .join("");
  return `<p>These releases haven't changed in a while:</p><ul>${rows}</ul>
    <p>Any change to a release, or Keep on its page, cancels its deletion. Releases in staging are never deleted automatically.</p>`;
}

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_SMTP_API_KEY,
});

export interface IEmailContentData {
  subject: string;
  body: string;
  recipientEmail: string;
}
export interface DormantProjectEmailAlert extends IEmailContentData {
  projectId: number;
  notice?: DormantNotice;
  scheduledAt?: string;
}

export interface StaleReleaseEmailAlert extends IEmailContentData {
  releaseNotices: {
    releaseId: number;
    notice: "warned" | "reminded";
    scheduledAt: string | null;
  }[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SystemStatusEmailAlert extends IEmailContentData {}

export async function sendEmail(content: IEmailContentData) {
  const { recipientEmail, subject, body } = content;

  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: recipientEmail }],
    subject: subject,
    htmlContent: body,
    sender: {
      name: process.env.BREVO_SMTP_SENDER_NAME,
      email: process.env.BREVO_SMTP_SENDER_EMAIL,
    },
  });
}

type BrevoQuotaDetail = { isDailyFreeQuotaLow: boolean; remainingQuota: number };

export async function getBrevoSMTPDailyQuota(): Promise<BrevoQuotaDetail> {
  const LOW_QUOTA_THRESHOLD = 10;
  const account = await brevo.account.getAccount();
  const remainingQuota = account.plan.at(0)?.credits ?? 0;
  const isDailyFreeQuotaLow = remainingQuota <= LOW_QUOTA_THRESHOLD;
  return { isDailyFreeQuotaLow, remainingQuota };
}
