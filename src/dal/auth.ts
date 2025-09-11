import { User } from "@models/user";
import { Nullable } from "types";
import { Op } from "sequelize";

export async function createUser(
  email: string,
  username: string,
  password: string,
): Promise<User> {
  return await User.create({ email, username, password }, { isNewRecord: true });
}

export async function isEmailAlreadyInUse(email: string): Promise<boolean> {
  const found = await User.findOne({
    attributes: { exclude: ["id"] },
    where: { email: email },
  });
  return found !== null;
}

export async function findUserByEmail(email: string): Promise<Nullable<Readonly<User>>> {
  return await User.findOne({ where: { email: email } });
}

export async function findUserByPublicId(
  publicId: string,
): Promise<Nullable<Readonly<User>>> {
  return await User.findOne({ where: { public_id: publicId } });
}

/**
 *
 * @param publicId Requires User Public Id
 * @returns Boolean Value
 */
export async function isUserVerified(publicId: string): Promise<boolean> {
  const found = await User.findOne({
    where: { [Op.and]: [{ public_id: publicId }, { is_verified: true }] },
  });
  return found !== null;
}

export async function verifyUser(publicId: string): Promise<void> {
  await User.update({ is_verified: true }, { where: { public_id: publicId } });
}
