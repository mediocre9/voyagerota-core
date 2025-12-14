import { redis } from "@config/redis.connection.config";
import { isDevEnvironment } from "@utils/utils";

function _getPrefixedEmailKeyFormat(userId: string): string {
  const prefixKeyType = "verification";
  const format = `${prefixKeyType}:${userId}`;
  return format;
}

export async function createOTPCode(userId: string, otpCode: string): Promise<void> {
  // 3 mins in dev environment......
  // 5 mins in prod.....
  const EXPIRE_TIME_IN_SECONDS = isDevEnvironment() ? 3 * 60 : 5 * 60;
  const key = _getPrefixedEmailKeyFormat(userId);
  await redis.setex(key, EXPIRE_TIME_IN_SECONDS, otpCode);
}

export async function removeOTPCode(userId: string): Promise<void> {
  const key = _getPrefixedEmailKeyFormat(userId);
  await redis.del(key);
}

export async function isOTPCodeExpired(userId: string): Promise<boolean> {
  const key = _getPrefixedEmailKeyFormat(userId);
  const expirationTime = await redis.ttl(key);

  // Please refer to the following docs section:
  // https://redis.io/docs/latest/commands/ttl/#:~:text=The%20command%20returns%20%2D2%20if%20the%20key%20does%20not%20exist.
  return expirationTime == -2;
}

export async function compareOTPCode(userId: string, code: string): Promise<boolean> {
  const key = _getPrefixedEmailKeyFormat(userId);
  const value = await redis.get(key);
  return code === value;
}
