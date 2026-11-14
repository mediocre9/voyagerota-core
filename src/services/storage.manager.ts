import { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { Readable } from "node:stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type StorageManagerDirectory = {
  onDirectory: "storage" | "trash";
};

export type StoredFile = { name: string; onDirectory: "storage" | "trash" | "incoming" };

// local keeps files on this machine, r2 keeps them in a cloudflare r2 bucket....
export function isR2Storage(): boolean {
  return process.env.STORAGE_DRIVER === "r2";
}

let _client: S3Client | null = null;

function _r2(): S3Client {
  _client ??= new S3Client({
    region: "auto",
    endpoint:
      process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: true,
  });
  return _client;
}

function _bucket(): string {
  return process.env.R2_BUCKET ?? "";
}

function _key(filename: string, onDirectory: "storage" | "trash"): string {
  return `${onDirectory}/${filename}`;
}

function _isMissing(error: unknown): boolean {
  const name = (error as { name?: string }).name;
  return name === "NoSuchKey" || name === "NotFound";
}

// same error shape as a missing local file so callers handle both the same way....
function _missingFile(filename: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`${filename} is missing from storage`);
  error.code = "ENOENT";
  return error;
}

export class StorageManager {
  private constructor() {}

  static readonly DEFAULT_STORAGE_DIRECTORY_PATH = path.join(
    import.meta.dirname,
    "..",
    "..",
    "storage",
  );

  static readonly DEFAULT_TRASH_DIRECTORY_PATH = path.join(
    import.meta.dirname,
    "..",
    "..",
    "storage",
    "trash",
  );

  static async destroy(filename: string, { onDirectory }: StorageManagerDirectory): Promise<void> {
    if (isR2Storage()) {
      await _r2().send(
        new DeleteObjectCommand({ Bucket: _bucket(), Key: _key(filename, onDirectory) }),
      );
      return;
    }

    const STORAGE_PATH =
      onDirectory === "storage"
        ? StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH
        : StorageManager.DEFAULT_TRASH_DIRECTORY_PATH;

    const pathToFile = path.join(STORAGE_PATH, filename);
    await fs.rm(pathToFile);
  }

  static async moveToStorageDirectory(filename: string): Promise<void> {
    if (isR2Storage()) {
      await StorageManager._moveObject(filename, "trash", "storage");
      return;
    }

    const newFilePath = path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename);
    const oldFilePath = path.join(StorageManager.DEFAULT_TRASH_DIRECTORY_PATH, filename);
    await fs.rename(oldFilePath, newFilePath);
  }

  static async moveToTrashDirectory(filename: string): Promise<void> {
    if (isR2Storage()) {
      await StorageManager._moveObject(filename, "storage", "trash");
      return;
    }

    const oldFilePath = path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename);
    const newFilePath = path.join(StorageManager.DEFAULT_TRASH_DIRECTORY_PATH, filename);
    await fs.rename(oldFilePath, newFilePath);
  }

  static isFileOnDirectory(filename: string, { onDirectory }: StorageManagerDirectory): boolean {
    const STORAGE_PATH =
      onDirectory === "storage"
        ? StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH
        : StorageManager.DEFAULT_TRASH_DIRECTORY_PATH;
    const fileExists = fsSync.existsSync(path.join(STORAGE_PATH, filename));
    return fileExists;
  }

  // works for both drivers, r2 needs a request so it can't be sync....
  static async exists(
    filename: string,
    { onDirectory }: StorageManagerDirectory,
  ): Promise<boolean> {
    if (!isR2Storage()) return StorageManager.isFileOnDirectory(filename, { onDirectory });

    try {
      await _r2().send(
        new HeadObjectCommand({ Bucket: _bucket(), Key: _key(filename, onDirectory) }),
      );
      return true;
    } catch (error) {
      if (_isMissing(error)) return false;
      throw error;
    }
  }

  static async getDirentFiles(): Promise<readonly Dirent[]> {
    const files = await fs.readdir(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, {
      withFileTypes: true,
      recursive: true,
    });

    return files;
  }

  // every stored file and where it is, r2 also reports uploads still waiting on this machine....
  static async listFiles(): Promise<StoredFile[]> {
    if (!isR2Storage()) {
      const local = (await StorageManager.getDirentFiles()).filter((file) => file.isFile());
      return local.map((file) => ({
        name: file.name,
        onDirectory: StorageManager.isFileOnDirectory(file.name, { onDirectory: "trash" })
          ? "trash"
          : "storage",
      }));
    }

    // only top level files, the local trash folder is no longer used with r2....
    const incoming = await fs.readdir(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, {
      withFileTypes: true,
    });
    const files: StoredFile[] = incoming
      .filter((file) => file.isFile())
      .map((file) => ({ name: file.name, onDirectory: "incoming" }));
    for (const onDirectory of ["storage", "trash"] as const) {
      let token: string | undefined;
      do {
        const page = await _r2().send(
          new ListObjectsV2Command({
            Bucket: _bucket(),
            Prefix: `${onDirectory}/`,
            ContinuationToken: token,
          }),
        );
        for (const object of page.Contents ?? []) {
          const name = object.Key?.slice(onDirectory.length + 1);
          if (name) files.push({ name, onDirectory });
        }
        token = page.NextContinuationToken;
      } while (token);
    }
    return files;
  }

  // an upload lands on this machine first, r2 then takes it over and the local copy goes....
  static async commitUpload(filename: string): Promise<void> {
    if (!isR2Storage()) return;

    const localPath = path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename);
    const body = await fs.readFile(localPath);
    await _r2().send(
      new PutObjectCommand({
        Bucket: _bucket(),
        Key: _key(filename, "storage"),
        Body: body,
        ContentType: "application/octet-stream",
      }),
    );
    await fs.rm(localPath, { force: true });
  }

  // a rejected upload never reaches r2, so only its local copy needs to go....
  static async discardUpload(filename: string): Promise<void> {
    if (!isR2Storage()) return;
    await fs.rm(path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename), {
      force: true,
    });
  }

  static async discardIncoming(filename: string): Promise<void> {
    await fs.rm(path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename), {
      force: true,
    });
  }

  static async readFile(filename: string): Promise<Buffer> {
    if (!isR2Storage()) {
      return await fs.readFile(path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename));
    }

    // inspection can run right after the upload, before the local copy is gone....
    const localPath = path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename);
    if (fsSync.existsSync(localPath)) return await fs.readFile(localPath);

    const body = await StorageManager._getObject(filename);
    return Buffer.from(await body.transformToByteArray());
  }

  // opened before any header is sent, a missing file throws ENOENT on both drivers....
  static async openReadStream(filename: string): Promise<Readable> {
    if (!isR2Storage()) {
      const stream = fsSync.createReadStream(
        path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename),
      );
      await once(stream, "open");
      return stream;
    }

    const body = await StorageManager._getObject(filename);
    return body as Readable;
  }

  private static async _getObject(filename: string) {
    try {
      const object = await _r2().send(
        new GetObjectCommand({ Bucket: _bucket(), Key: _key(filename, "storage") }),
      );
      if (!object.Body) throw _missingFile(filename);
      return object.Body;
    } catch (error) {
      if (_isMissing(error)) throw _missingFile(filename);
      throw error;
    }
  }

  private static async _moveObject(
    filename: string,
    from: "storage" | "trash",
    to: "storage" | "trash",
  ): Promise<void> {
    await _r2().send(
      new CopyObjectCommand({
        Bucket: _bucket(),
        CopySource: `${_bucket()}/${_key(filename, from)}`,
        Key: _key(filename, to),
      }),
    );
    await _r2().send(new DeleteObjectCommand({ Bucket: _bucket(), Key: _key(filename, from) }));
  }
}
