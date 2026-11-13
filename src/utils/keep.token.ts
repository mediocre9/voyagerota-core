import crypto from "node:crypto";
import { isDevEnvironment } from "@config/config";

// a keep link is only valid for the deadline it was sent with, keeping the project clears it....
// without a secret no notice goes out in production, so nothing is ever deleted unannounced....
function _secret(): string {
  const secret = process.env.KEEP_LINK_SECRET;
  if (secret) return secret;
  if (isDevEnvironment()) return "voyagerota-development-keep-secret";
  throw new Error("KEEP_LINK_SECRET is not set!");
}

function _sign(payload: string): string {
  return crypto.createHmac("sha256", _secret()).update(payload).digest("base64url");
}

export function createKeepToken(projectPublicId: string, scheduledAt: Date): string {
  const payload = `${projectPublicId}.${scheduledAt.getTime()}`;
  return Buffer.from(`${payload}.${_sign(payload)}`).toString("base64url");
}

export function readKeepToken(token: string): { projectId: string; scheduledAt: number } | null {
  const [projectId, time, signature] = Buffer.from(token, "base64url").toString().split(".");
  if (!projectId || !time || !signature) return null;

  const expected = _sign(`${projectId}.${time}`);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  return { projectId, scheduledAt: Number(time) };
}

export function keepUrl(token: string): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  return `${appUrl.replace(/\/$/, "")}/keep/${token}`;
}
