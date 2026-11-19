import { clerkClient } from "@clerk/express";
import * as UserDAL from "@dal/user.dal";
import { User } from "@models/user.model";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import NodeCache from "node-cache";
import { EmailQueue } from "@queues/email.queue";
import { getWelcomeTemplate, IEmailContentData } from "@config/email.client";
import { Logger } from "@utils/logger";

const welcomeQueue = new EmailQueue<IEmailContentData>();

// once per new account, the job id keeps it from ever going out twice....
async function _sendWelcome(user: User, firstName: string | null): Promise<void> {
  try {
    await welcomeQueue.enqueueEmail(
      {
        subject: "Welcome to VoyagerOTA",
        recipientEmail: user.getEmail(),
        body: getWelcomeTemplate(firstName),
        preheader: "Your first over-the-air update in 4 steps.",
        note: "You're getting this because you created a VoyagerOTA account. This is the only welcome email.",
      },
      `welcome-${user.getId()}`,
    );
  } catch (error) {
    // a missed welcome email must never block signing in....
    Logger.error(`Welcome email not queued: ${(error as Error).message}`);
  }
}

// clerk user id -> local user public id, so we don't hit the clerk api on every request....
const clerkUserCache = new NodeCache({ stdTTL: 10 * 60, checkperiod: 120 });

export async function resolveClerkUser(clerkUserId: string): Promise<User> {
  const cachedPublicId = clerkUserCache.get<string>(clerkUserId);
  if (cachedPublicId) {
    const cachedUser = await UserDAL.findUserByPublicId(cachedPublicId);
    if (cachedUser) return cachedUser;
  }

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  );

  // only link accounts by email once clerk has verified that email....
  if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
    throw new ApiError("A verified email address is required!", StatusCodes.FORBIDDEN);
  }

  const username =
    clerkUser.username ??
    ([clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      primaryEmail.emailAddress.split("@")[0]);

  const { user, created } = await UserDAL.findOrCreateUserByEmail({
    email: primaryEmail.emailAddress,
    username: username,
    pictureUrl: clerkUser.imageUrl || undefined,
  });

  if (created) await _sendWelcome(user, clerkUser.firstName);

  clerkUserCache.set(clerkUserId, user.getPublicId());
  return user;
}
