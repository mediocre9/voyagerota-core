import { User } from "@models/user.model";
import { Nullable } from "@interfaces/common/common";

export type GoogleOAuthUserData = {
  username: string;
  email: string;
  googleId: string;
  googleProfilePic: string;
};

export async function createOAuthUser(data: GoogleOAuthUserData): Promise<[User, boolean]> {
  const { email, googleId, googleProfilePic, username } = data;
  const [user, isNewAccount] = await User.findOrCreate({
    where: {
      google_id: googleId,
    },
    defaults: {
      username: username,
      email: email,
      google_id: googleId,
      picture_url: googleProfilePic,
    },
  });

  return [user, isNewAccount];
}

export async function findUserByPublicId(publicId: string): Promise<Nullable<User>> {
  return await User.findOne({ where: { public_id: publicId } });
}
