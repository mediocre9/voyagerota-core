import { BrevoClient } from "@getbrevo/brevo";
import type { DormantNotice } from "@models/project.model";
import { DELETED_PROJECT_DAYS, isRestoreEnabled, LIMITS } from "@config/limits";

// names come from users, so they never go into an email as html....
export function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// links in emails, the landing and docs addresses follow app.<domain> unless set....
export function emailLinks() {
  const app = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const isAppDomain = app.includes("://app.");
  const site = (
    process.env.SITE_URL ?? (isAppDomain ? app.replace("://app.", "://") : app)
  ).replace(/\/$/, "");
  const docs = (
    process.env.DOCS_URL ?? (isAppDomain ? app.replace("://app.", "://docs.") : `${app}/docs`)
  ).replace(/\/$/, "");
  return {
    app,
    site,
    docs,
    privacy: `${site}/privacy`,
  };
}

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
  data = escapeHtml(data);
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
    ${
      isRestoreEnabled()
        ? `<p>You can restore it from your projects within ${DELETED_PROJECT_DAYS} days.</p>`
        : "<p>It was removed for good, with its releases and firmware files.</p>"
    }`,
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
        `<li><strong>${escapeHtml(item.projectName)}</strong> v${escapeHtml(item.version)} (${escapeHtml(item.channel)}): ${
          item.deletesOn
            ? `will be deleted on <strong>${item.deletesOn}</strong>`
            : "has been waiting a long time to be promoted"
        }</li>`,
    )
    .join("");
  return `<p>These releases haven't changed in a while:</p><ul>${rows}</ul>
    <p>Any change to a release, or Keep on its page, cancels its deletion. Releases in staging are never deleted automatically.</p>`;
}

export function getProjectDeletedByOwnerTemplate(
  projectName: string,
  restoreUntil: string,
  projectsUrl: string,
): string {
  return `<p>Your project <strong>${escapeHtml(projectName)}</strong> was deleted. Its devices no longer receive updates.</p>
    <p>Changed your mind? You can restore it until <strong>${restoreUntil}</strong> from <a href="${projectsUrl}">your projects</a>, under Recently deleted. After that it is removed for good.</p>`;
}

export function getProjectDeletedForGoodTemplate(projectName: string): string {
  return `<p>Your project <strong>${escapeHtml(projectName)}</strong> was deleted for good, with its releases, firmware files and devices.</p>
    <p>If you didn't do this, sign in and check your account right away.</p>`;
}

export type FailureAlertData = {
  projectName: string;
  version: string;
  updated: number;
  failed: number;
  willRevoke: boolean;
};

export function getFailureAlertTemplate(data: FailureAlertData): string {
  const next = data.willRevoke
    ? "<p>Auto-revoke is on, so this release is being revoked and your devices will roll back to the previous release.</p>"
    : "<p>Open the release in VoyagerOTA to check the error codes, and revoke it if it needs to be pulled.</p>";
  return `<p>Release <strong>v${escapeHtml(data.version)}</strong> of <strong>${escapeHtml(data.projectName)}</strong> crossed your failure threshold.</p>
    <p><strong>${data.failed}</strong> device(s) failed to update, <strong>${data.updated}</strong> updated successfully.</p>${next}`;
}

const step = (n: number, title: string, rest: string) =>
  `<tr><td width="34" valign="top" style="padding:6px 0;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;background:#f4f4f5;border:1px solid #e4e4e7;text-align:center;font-size:12px;font-weight:600;color:#18181b;">${n}</span></td>
  <td style="padding:6px 0;font-size:14px;line-height:1.55;color:#3f3f46;"><strong style="color:#18181b;">${title}</strong> ${rest}</td></tr>`;

export function getWelcomeTemplate(firstName?: string | null): string {
  const links = emailLinks();
  const greeting = firstName?.trim()
    ? `Welcome to VoyagerOTA, ${escapeHtml(firstName.trim())}`
    : "Welcome to VoyagerOTA";

  return `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;color:#18181b;">${greeting}</h1>
  <p style="margin:0 0 24px;">Thanks for signing up. VoyagerOTA sends new firmware to your ESP32 boards over the air, and tests every build on a staging board first, so a bad build never reaches your whole fleet.</p>
  <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.4px;">Your first update in 4 steps</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px;">
  ${step(1, "Create a project", "to get its project ID and API key.")}
  ${step(2, "Add VoyagerOTAClient", "to your sketch from the Arduino Library Manager.")}
  ${step(3, "Flash a staging board", "and approve it in the dashboard.")}
  ${step(4, "Upload a build,", "test it on staging, then promote it to production.")}
  </table>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr><td style="background:#15803d;border-radius:8px;">
  <a href="${links.app}/projects" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;white-space:nowrap;">Open the dashboard</a>
  </td></tr></table>
  <p style="margin:0;font-size:14px;">New to OTA updates? <a href="${links.docs}/quickstart" style="color:#15803d;font-weight:500;text-decoration:none;">Read the quickstart</a></p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
  <tr><td style="padding:14px 16px;font-size:13px;line-height:1.55;color:#52525b;">
  <strong style="color:#18181b;">Free, and in early alpha.</strong> Each account gets ${LIMITS.projects} projects, ${LIMITS.devicesPerProject} devices per project and ${LIMITS.releasesPerProject} releases per project. Things may still change, and feedback helps a lot.
  </td></tr></table>`;
}

// one frame for every email: logo, white card, footer. tables and inline styles because
// gmail and outlook ignore most css, links without a style get the brand green....
export function renderEmailLayout(
  body: string,
  options: { preheader?: string; note?: string } = {},
) {
  const links = emailLinks();
  const linkStyle = 'style="color:#15803d;font-weight:500;"';
  const content = body
    .replace(/<a (?![^>]*style=)/g, `<a ${linkStyle} `)
    .replace(/^\s*<p>/, '<p style="margin-top:0;">');
  const note = options.note ?? "You're getting this email about your VoyagerOTA account.";
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
<tr><td style="padding:0 4px 18px;"><a href="${links.site}" style="text-decoration:none;color:#18181b;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:24px;height:24px;background:#18181b;border-radius:6px;text-align:center;vertical-align:middle;line-height:0;"><span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:#22c55e;"></span></td>
<td style="padding-left:8px;font-size:15px;font-weight:600;color:#18181b;">Voyager<span style="color:#71717a;">OTA</span></td>
</tr></table></a></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:28px 24px;font-size:15px;line-height:1.6;color:#3f3f46;">${content}</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.6;color:#a1a1aa;">${escapeHtml(note)}<br>
<a href="${links.site}" style="color:#71717a;">voyagerota.com</a>&nbsp;&nbsp;&nbsp;<a href="${links.privacy}" style="color:#71717a;">Privacy</a>
</td></tr></table></td></tr></table></body></html>`;
}

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_SMTP_API_KEY,
});

export interface IEmailContentData {
  subject: string;
  body: string;
  recipientEmail: string;
  preheader?: string;
  note?: string;
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
  const { recipientEmail, subject, body, preheader, note } = content;
  const support = process.env.SUPPORT_EMAIL?.trim();

  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: recipientEmail }],
    subject: subject,
    htmlContent: renderEmailLayout(body, { preheader, note }),
    ...(support ? { replyTo: { email: support } } : {}),
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
