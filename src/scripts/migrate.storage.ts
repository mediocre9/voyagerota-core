import * as fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { StorageManager } from "@services/storage.manager";

// npm run storage:migrate.... copies ./storage and ./storage/trash into the r2 bucket, local files stay....
const client = new S3Client({
  region: "auto",
  endpoint:
    process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
  forcePathStyle: true,
});

async function copyDirectory(directory: string, prefix: "storage" | "trash"): Promise<number> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
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

if (!process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
  console.log("Set R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY first.");
  process.exitCode = 1;
} else {
  const stored = await copyDirectory(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, "storage");
  const trashed = await copyDirectory(StorageManager.DEFAULT_TRASH_DIRECTORY_PATH, "trash");
  console.log(
    `Copied ${stored} file(s) and ${trashed} trashed file(s). Now set STORAGE_DRIVER=r2.`,
  );
}
