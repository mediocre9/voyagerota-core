import { CronJob } from "cron";
import "@models/index";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { EmailQueue } from "@queues/email.queue";
import { isDevEnvironment, isFastDormantTest } from "@config/config";
import { redis } from "@config/redis.connection.config";
import {
  DormantProjectEmailAlert,
  EmailTemplate,
  getReleaseDigestTemplate,
  getTemplate,
  StaleReleaseEmailAlert,
} from "@config/email.client";
import { DormantNotice, Project } from "@models/project.model";
import { Release, ReleaseChannel } from "@models/release.model";
import { createKeepToken, keepUrl } from "@utils/keep.token";
import { Logger } from "@utils/logger";

const queue = new EmailQueue<DormantProjectEmailAlert>();
const digestQueue = new EmailQueue<StaleReleaseEmailAlert>();

type NonProductionChannel = Extract<ReleaseChannel, "draft" | "staging">;

function _getEmailTemplateType(channel: NonProductionChannel): EmailTemplate {
  return channel === "draft" ? EmailTemplate.DRAFT_RELEASE : EmailTemplate.STAGING_RELEASE;
}

// * in development a "day" is a minute, a second with DORMANT_FAST_TEST....
const DAY = isFastDormantTest() ? 1000 : isDevEnvironment() ? 60 * 1000 : 24 * 60 * 60 * 1000;
const LOCK_KEY = "vygr:cron:dormant-projects";

// whole seconds, that's what the database keeps and what the keep link is signed with....
function _getScheduledDeletionDate(from: Date, days: number): Date {
  return new Date(Math.floor((from.getTime() + days * DAY) / 1000) * 1000);
}

type DormantTier = "empty" | "draft" | "staging";

// how long a project may sit idle, and how much notice it gets, by how far it got....
const TIERS: Record<DormantTier, { idleDays: number; noticeDays: number }> = {
  empty: { idleDays: 14, noticeDays: 7 },
  draft: { idleDays: 21, noticeDays: 7 },
  staging: { idleDays: 45, noticeDays: 14 },
};

function _getDormantTier(project: Project): DormantTier | null {
  if (project.hasNoReleases()) return "empty";
  const channels = project.Releases!.map((release) => release.getChannel());
  if (channels.some((channel) => channel === "production" || channel === "revoked")) return null;
  return channels.includes("staging") ? "staging" : "draft";
}

function _getNextNotice(
  project: Project,
  tier: DormantTier,
  now: Date,
): { notice: DormantNotice; scheduledAt: Date } | null {
  const { idleDays, noticeDays } = TIERS[tier];
  const notice = project.getDataValue("dormant_notice");
  const scheduledAt = project.getDataValue("deletion_scheduled_at");

  if (!notice || !scheduledAt) {
    const idle = now.getTime() - new Date(project.last_activity!).getTime();
    if (idle < idleDays * DAY) return null;
    return { notice: "warned", scheduledAt: _getScheduledDeletionDate(now, noticeDays) };
  }

  const left = new Date(scheduledAt).getTime() - now.getTime();
  if (notice === "warned" && noticeDays > 7 && left <= 7 * DAY && left > DAY) {
    return { notice: "reminded", scheduledAt: new Date(scheduledAt) };
  }
  if (notice !== "final" && left <= DAY) {
    return { notice: "final", scheduledAt: new Date(scheduledAt) };
  }
  return null;
}

function _getSubject(projectName: string, notice: DormantNotice, date: string): string {
  if (notice === "reminded") return `Reminder: ${projectName} will be deleted on ${date}`;
  if (notice === "final") return `Last notice: ${projectName} will be deleted on ${date}`;
  return `Action needed: project deletion scheduled on ${date}`;
}

function _isDryRun(): boolean {
  return process.env.DORMANT_DRY_RUN === "true";
}

async function _notifyDormantProjects(now: Date): Promise<void> {
  const smallestIdle = Math.min(...Object.values(TIERS).map((tier) => tier.idleDays));
  const projects = await ProjectDAL.findIdleProjects(
    150,
    new Date(now.getTime() - smallestIdle * DAY),
  );

  for (const project of projects) {
    const tier = _getDormantTier(project);
    if (!tier) continue;

    const next = _getNextNotice(project, tier, now);
    if (!next) continue;

    const date = next.scheduledAt.toDateString();
    const templateType =
      tier === "empty"
        ? EmailTemplate.NO_RELEASE
        : _getEmailTemplateType(project.getInitialReleaseChannel() as NonProductionChannel);
    const template = getTemplate(project.getProjectName(), templateType, {
      scheduledDate: date,
      keepUrl: keepUrl(createKeepToken(project.getPublicId(), next.scheduledAt)),
    });

    if (_isDryRun()) {
      Logger.info(`[dry run] ${next.notice} ${project.getPublicId()} (${tier}) for ${date}`);
      continue;
    }

    await queue.enqueueEmail(
      {
        subject: _getSubject(project.getProjectName(), next.notice, date),
        projectId: project.getId(),
        recipientEmail: project.User!.getEmail(),
        body: template,
        notice: next.notice,
        scheduledAt: next.scheduledAt.toISOString(),
      },
      `dormant-${project.getId()}-${next.notice}-${next.scheduledAt.getTime()}`,
    );
    Logger.info(`Enqueued ${next.notice} notice for dormant project ${project.getPublicId()}`);
  }
}

// releases left behind in projects that already shipped, one digest per user....
const RELEASE_RULES = {
  emptyDraft: { idleDays: 14, noticeDays: 7 },
  draft: { idleDays: 21, noticeDays: 7 },
  staging: { idleDays: 30, noticeDays: 0 },
};

type ReleaseDigest = { userId: number; items: Release[]; at: Map<number, Date | null> };

async function _notifyStaleReleases(now: Date): Promise<void> {
  const smallestIdle = Math.min(...Object.values(RELEASE_RULES).map((rule) => rule.idleDays));
  const releases = await ReleaseDAL.findStaleReleases(
    new Date(now.getTime() - smallestIdle * DAY),
    300,
  );

  const digests = new Map<string, ReleaseDigest>();
  for (const release of releases) {
    if (release.getDataValue("stale_notice")) continue;

    const isStaging = release.isStaging();
    const rule = isStaging
      ? RELEASE_RULES.staging
      : release.Artifacts?.length
        ? RELEASE_RULES.draft
        : RELEASE_RULES.emptyDraft;
    const idle = now.getTime() - new Date(release.getDataValue("updated_at")!).getTime();
    if (idle < rule.idleDays * DAY) continue;

    const user = release.Project!.User!;
    const digest: ReleaseDigest = digests.get(user.getEmail()) ?? {
      userId: user.id!,
      items: [],
      at: new Map(),
    };
    digest.items.push(release);
    digest.at.set(
      release.getId(),
      isStaging ? null : _getScheduledDeletionDate(now, rule.noticeDays),
    );
    digests.set(user.getEmail(), digest);
  }

  for (const [email, digest] of digests) {
    const body = getReleaseDigestTemplate(
      digest.items.map((release) => ({
        projectName: release.Project!.getProjectName(),
        version: release.getVersion(),
        channel: release.getChannel(),
        deletesOn: digest.at.get(release.getId())?.toDateString() ?? null,
      })),
    );

    if (_isDryRun()) {
      Logger.info(`[dry run] release digest for ${email}: ${digest.items.length} release(s)`);
      continue;
    }

    await digestQueue.enqueueEmail(
      {
        subject: `${digest.items.length} release(s) need your attention`,
        recipientEmail: email,
        body: body,
        releaseNotices: digest.items.map((release) => {
          const scheduledAt = digest.at.get(release.getId()) ?? null;
          return {
            releaseId: release.getId(),
            notice: scheduledAt ? "warned" : "reminded",
            scheduledAt: scheduledAt?.toISOString() ?? null,
          };
        }),
      },
      `stale-releases-${digest.userId}-${Math.floor(now.getTime() / DAY)}`,
    );
    Logger.info(`Enqueued release digest for user #${digest.userId}`);
  }
}

export async function runDormantProjectCron(now: Date = new Date()): Promise<void> {
  // * only one instance runs the cleanup at a time....
  if ((await redis.set(LOCK_KEY, "1", "EX", 10 * 60, "NX")) !== "OK") {
    Logger.info("Dormant project cron already running elsewhere, skipped");
    return;
  }

  try {
    await _notifyDormantProjects(now);
    await _notifyStaleReleases(now);
  } finally {
    await redis.del(LOCK_KEY);
  }
}

// * Runs daily at 12:00am....
// * for development 5 minutes, 5 seconds with DORMANT_FAST_TEST....
const CRON_EXPRESSION = isFastDormantTest()
  ? "*/5 * * * * *"
  : isDevEnvironment()
    ? "*/300 * * * * *"
    : "0 0 0 * * *";

const dormantProjectCron = new CronJob(CRON_EXPRESSION, async (): Promise<void> => {
  try {
    await runDormantProjectCron();
  } catch (error) {
    Logger.error((error as Error).message);
  }
});

dormantProjectCron.start();
