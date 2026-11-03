import { readFileSync } from "node:fs";
import path from "node:path";
import { isDevEnvironment } from "@config/config";

export interface GoogleOAuthCredentials {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
}

export interface GoogleOAuthConfigResult {
  credentials?: GoogleOAuthCredentials;
  missing: string[];
}

interface OAuthClientSecretFile {
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
}

const OAUTH_CLIENT_SECRET_PATH = path.resolve(
  import.meta.dirname,
  "../../oauth-client-secret.json",
);

function loadOAuthClientSecretFile(): OAuthClientSecretFile | undefined {
  let raw: string;

  try {
    raw = readFileSync(OAUTH_CLIENT_SECRET_PATH, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw new Error(`Unable to read oauth-client-secret.json: ${(error as Error).message}`);
  }

  try {
    return JSON.parse(raw) as OAuthClientSecretFile;
  } catch {
    throw new Error("oauth-client-secret.json is not valid JSON.");
  }
}

export function resolveGoogleOAuthConfig(): GoogleOAuthConfigResult {
  const fileConfig = loadOAuthClientSecretFile();
  const web = fileConfig?.web;

  // Use the file exclusively when it exists, otherwise fall back to env vars.
  // This avoids mixing credentials from two different sources.
  const clientID = web ? web.client_id : process.env.GOOGLE_CLIENT_ID;
  const clientSecret = web ? web.client_secret : process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = web
    ? web.redirect_uris?.[isDevEnvironment() ? 0 : 1]
    : isDevEnvironment()
      ? process.env.GOOGLE_REDIRECT_URI_DEV
      : process.env.GOOGLE_REDIRECT_URI_PROD;

  const missing: string[] = [];
  if (!clientID) missing.push("client_id (GOOGLE_CLIENT_ID)");
  if (!clientSecret) missing.push("client_secret (GOOGLE_CLIENT_SECRET)");
  if (!callbackURL) missing.push("redirect URI (GOOGLE_REDIRECT_URI_DEV/PROD)");

  if (!clientID || !clientSecret || !callbackURL) {
    return { missing };
  }

  return {
    credentials: {
      clientID,
      clientSecret,
      callbackURL,
    },
    missing: [],
  };
}
