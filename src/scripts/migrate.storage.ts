import * as fs from "node:fs/promises";
import path from "node:path";
import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertR2Settings, getR2Endpoint, StorageManager } from "@services/storage.manager";

// npm run storage:migrate.... copies ./storage and ./storage/trash into the r2 bucket, local files stay....
function _client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "",
    },
    forcePathStyle: true,
  });
}

async function copyDirectory(
  client: S3Client,
  directory: string,
  prefix: "storage" | "trash",
): Promise<number> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile() || entry.name === ".gitkeep") continue;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET?.trim(),
        Key: `${prefix}/${entry.name}`,
        Body: await fs.readFile(path.join(directory, entry.name)),
        ContentType: "application/octet-stream",
      }),
    );
    copied++;
    console.log(`${prefix}/${entry.name}`);
  }
  return copied;
}

// the usual mistakes, explained instead of a raw sdk error....
function _explain(error: unknown): string {
  const { code, name, message } = error as { code?: string; name?: string; message?: string };
  if (code === "EPROTO" || message?.includes("handshake")) {
    return "Cloudflare refused the connection. R2_ACCOUNT_ID or R2_ENDPOINT is wrong.";
  }
  if (code === "ENOTFOUND") return "The R2 endpoint host doesn't exist. Check R2_ACCOUNT_ID.";
  if (name === "NoSuchBucket" || name === "NotFound") {
    return `Bucket "${process.env.R2_BUCKET}" was not found in this account. Check R2_BUCKET.`;
  }
  if (
    name === "InvalidAccessKeyId" ||
    name === "SignatureDoesNotMatch" ||
    name === "Unauthorized"
  ) {
    return "The access keys were rejected. Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.";
  }
  if (name === "AccessDenied" || name === "Forbidden") {
    return "The token can't use this bucket. Give it Object Read & Write on the bucket.";
  }
  return message ?? String(error);
}

try {
  assertR2Settings();
  console.log(`R2 endpoint: ${new URL(getR2Endpoint()).host}, bucket: ${process.env.R2_BUCKET}`);

  const client = _client();
  await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET?.trim() }));

  const stored = await copyDirectory(
    client,
    StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH,
    "storage",
  );
  const trashed = await copyDirectory(client, StorageManager.DEFAULT_TRASH_DIRECTORY_PATH, "trash");
  console.log(
    `Copied ${stored} file(s) and ${trashed} trashed file(s). Now set STORAGE_DRIVER=r2.`,
  );
} catch (error) {
  console.log(`Storage migration failed: ${_explain(error)}`);
  process.exitCode = 1;
}
