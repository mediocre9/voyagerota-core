import { PlanName, TRIAL_DAYS } from "@config/plans";
import { User } from "@models/user.model";
import { Nullable } from "../types";

export async function findUserByPublicId(publicId: string): Promise<Nullable<User>> {
  return await User.findOne({ where: { public_id: publicId } });
}

export type ExternalUserData = {
  username: string;
  email: string;
  pictureUrl?: string;
};

export async function findOrCreateUserByEmail(data: ExternalUserData): Promise<User> {
  const [user] = await User.findOrCreate({
    where: { email: data.email },
    defaults: {
      username: data.username,
      email: data.email,
      picture_url: data.pictureUrl,
      // every new account starts with a pro trial....
      trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return user;
}

export async function findUserById(id: number): Promise<Nullable<User>> {
  return await User.findByPk(id);
}

export async function findUserByEmail(email: string): Promise<Nullable<User>> {
  return await User.findOne({ where: { email } });
}

export async function updatePlan(
  userId: number,
  data: { plan?: PlanName; trialEndsAt?: Date | null; devicePacks?: number },
): Promise<void> {
  await User.update(
    {
      ...(data.plan ? { plan: data.plan } : {}),
      ...(data.trialEndsAt !== undefined ? { trial_ends_at: data.trialEndsAt } : {}),
      ...(data.devicePacks !== undefined ? { device_packs: data.devicePacks } : {}),
    },
    { where: { id: userId } },
  );
}
