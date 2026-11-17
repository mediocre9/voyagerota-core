import * as fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// database backups in their own r2 bucket, used by deploy/backup.sh and deploy/restore.sh....
// node --env-file=.env --import tsx src/scripts/backup.storage.ts <upload|list|download|prune> ...
const PREFIX = "db/";
const bucket = process.env.BACKUP_R2_BUCKET?.trim() ?? "";

function client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.BACKUP_R2_ACCESS_KEY_ID?.trim() ?? "",
      secretAccessKey: process.env.BACKUP_R2_SECRET_ACCESS_KEY?.trim() ?? "",
    },
    forcePathStyle: true,
  });
}

async function list(): Promise<{ name: string; size: number; at: Date }[]> {
  const files: { name: string; size: number; at: Date }[] = [];
  let token: string | undefined;
  do {
    const page = await client().send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX, ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      if (!object.Key || object.Key === PREFIX) continue;
      files.push({
        name: object.Key.slice(PREFIX.length),
        size: object.Size ?? 0,
        at: object.LastModified ?? new Date(0),
      });
    }
    token = page.NextContinuationToken;
  } while (token);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function main(): Promise<void> {
  const [command, arg1, arg2] = process.argv.slice(2);
  if (!bucket || !process.env.BACKUP_R2_ACCESS_KEY_ID) {
    throw new Error("BACKUP_R2_BUCKET and BACKUP_R2_ACCESS_KEY_ID must be set.");
  }

  if (command === "upload" && arg1) {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: PREFIX + path.basename(arg1),
        Body: await fs.readFile(arg1),
        ContentType: "application/gzip",
      }),
    );
    return;
  }

  if (command === "list") {
    for (const file of await list()) {
      console.log(`${file.name}\t${(file.size / 1024).toFixed(0)} KB\t${file.at.toISOString()}`);
    }
    return;
  }

  if (command === "latest") {
    console.log((await list()).at(-1)?.name ?? "");
    return;
  }

  if (command === "download" && arg1 && arg2) {
    const object = await client().send(
      new GetObjectCommand({ Bucket: bucket, Key: PREFIX + path.basename(arg1) }),
    );
    await fs.writeFile(arg2, await object.Body!.transformToByteArray());
    return;
  }

  // keeps the newest one whatever its age, a stopped cron never leaves the bucket empty....
  if (command === "prune" && arg1) {
    const cutoff = Date.now() - Number(arg1) * 24 * 60 * 60 * 1000;
    const files = await list();
    for (const file of files.slice(0, -1)) {
      if (file.at.getTime() < cutoff) {
        await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: PREFIX + file.name }));
        console.log(`removed ${file.name}`);
      }
    }
    return;
  }

  throw new Error(
    "Usage: backup.storage.ts upload <file> | list | latest | download <name> <file> | prune <days>",
  );
}

try {
  await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
