import { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";

type StorageManagerDirectory = {
  onDirectory: "storage" | "trash";
};

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
    const STORAGE_PATH =
      onDirectory === "storage"
        ? StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH
        : StorageManager.DEFAULT_TRASH_DIRECTORY_PATH;

    const pathToFile = path.join(STORAGE_PATH, filename);
    await fs.rm(pathToFile);
  }

  static async moveToStorageDirectory(filename: string): Promise<void> {
    const newFilePath = path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, filename);
    const oldFilePath = path.join(StorageManager.DEFAULT_TRASH_DIRECTORY_PATH, filename);
    await fs.rename(oldFilePath, newFilePath);
  }

  static async moveToTrashDirectory(filename: string): Promise<void> {
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

  static async getDirentFiles(): Promise<readonly Dirent[]> {
    const files = await fs.readdir(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, {
      withFileTypes: true,
      recursive: true,
    });

    return files;
  }
}
