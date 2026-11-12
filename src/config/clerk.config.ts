export const ClerkConfig = {
  SECRET_KEY: process.env.CLERK_SECRET_KEY,
  PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
};

export function isClerkEnabled(): boolean {
  return Boolean(ClerkConfig.SECRET_KEY && ClerkConfig.PUBLISHABLE_KEY);
}
