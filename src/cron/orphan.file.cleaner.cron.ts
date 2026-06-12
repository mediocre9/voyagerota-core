import * as ArtifactDAL from "@dal/artifact.dal";
import { Logger } from "@utils/logger";
import { isDevEnvironment } from "@config/config";
import { CronJob } from "cron";
import { StorageManager } from "@services/storage.manager";
import { setTimeout } from "node:timers/promises";
import * as path from "node:path";

function _isBinaryFile(filename: string): boolean {
  return path.extname(filename) === ".bin";
}

// * checks if file is 30 mins older.....
function _isRecentlyUploaded(filename: string): boolean {
  const MAX_TIME = isDevEnvironment() ? 60 * 1000 : (3600 / 2) * 1000; // dev 1 min ms and 30 mins in ms for prod....
  const fileTimestamp = parseInt(filename.split("-").at(0)!);
  const currentFileTimeDifference = Date.now() - fileTimestamp;
  return MAX_TIME > currentFileTimeDifference;
}

// *Runs on sunday 2 times a day at 12:00am and 3:00am......
// *for development 3 minutes.....
const CRON_EXPRESSION = isDevEnvironment() ? "*/180 * * * * *" : "0 0 0,3 * * 7";
const DELAY = 2 * 1000; // 2 seconds delay.....

const OrphanFileCronJob = new CronJob(CRON_EXPRESSION, async () => {
  Logger.info("Orphan file cleanup cron job inititated!");
  try {
    const files = await StorageManager.getDirentFiles();
    for (const file of files) {
      if (!_isBinaryFile(file.name) || _isRecentlyUploaded(file.name)) {
        continue;
      }

      // *if artifact does not exist On records
      // *try to delete the eligible orphan files
      // *on either storage or trash directories....
      const isOnStorage = StorageManager.isFileOnDirectory(file.name, {
        onDirectory: "storage",
      });

      const isOnTrash = StorageManager.isFileOnDirectory(file.name, {
        onDirectory: "trash",
      });

      const artifact = await ArtifactDAL.findParanoidArtifactByFilename(file.name);
      const isOrphan = !artifact && !file.isDirectory();
      const isOrphanFileOnStorage = isOrphan && isOnStorage;
      const isOrphanFileOnTrash = isOrphan && isOnTrash;

      if (isOrphanFileOnStorage) {
        await StorageManager.destroy(file.name, { onDirectory: "storage" });
        Logger.info(`${file.name} has been purged from storage directory!`);
      } else if (isOrphanFileOnTrash) {
        await StorageManager.destroy(file.name, { onDirectory: "trash" });
        Logger.info(`${file.name} has been purged from trash directory!`);
      }

      await setTimeout(DELAY);
    }
    Logger.info("Orphan file cleanup cron job finished");
  } catch (error) {
    Logger.error(error as string);
  }
});

OrphanFileCronJob.start();
