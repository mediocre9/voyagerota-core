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
    },
  });

  return user;
}
