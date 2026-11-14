import * as ArtifactDAL from "@dal/artifact.dal";
import { Logger } from "@utils/logger";
import { isDevEnvironment } from "@config/config";
import { CronJob } from "cron";
import { StorageManager } from "@services/storage.manager";
import { setTimeout } from "node:timers/promises";

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
const DELAY = 100; // 100ms delay.....

export async function runOrphanCleanup(): Promise<void> {
  Logger.info("Orphan file cleanup cron job inititated!");
  try {
    const files = await StorageManager.listFiles();
    for (const file of files) {
      if (_isRecentlyUploaded(file.name)) {
        continue;
      }

      // *with r2 a file left on this machine is either already in the bucket or a rejected upload....
      // *a recorded file that never reached the bucket is kept, run storage:migrate for it....
      if (file.onDirectory === "incoming") {
        const isInBucket =
          (await StorageManager.exists(file.name, { onDirectory: "storage" })) ||
          (await StorageManager.exists(file.name, { onDirectory: "trash" }));
        const isRecorded = Boolean(await ArtifactDAL.findParanoidArtifactByFilename(file.name));

        if (isInBucket || !isRecorded) {
          await StorageManager.discardIncoming(file.name);
          Logger.info(`${file.name} leftover upload removed from this machine!`);
        } else {
          Logger.warn(`${file.name} is only on this machine, run npm run storage:migrate`);
        }
        await setTimeout(DELAY);
        continue;
      }

      // *if artifact does not exist On records
      // *try to delete the eligible orphan files
      // *on either storage or trash directories....
      const artifact = await ArtifactDAL.findParanoidArtifactByFilename(file.name);
      const isOrphan = !artifact;
      const isOrphanFileOnStorage = isOrphan && file.onDirectory === "storage";
      const isOrphanFileOnTrash = isOrphan && file.onDirectory === "trash";

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
}

const OrphanFileCronJob = new CronJob(CRON_EXPRESSION, runOrphanCleanup);

OrphanFileCronJob.start();
