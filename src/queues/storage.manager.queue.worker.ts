import { Job, Worker as StorageManagerWorker } from "bullmq";
import {
  STORAGE_MANAGER_QUEUE_NAME,
  FileStorageInputData,
  FileStorageOutputData,
} from "@queues/storage.manager.queue";
import { redis as RedisConnection } from "@config/redis.connection.config";
import { StorageManager } from "@services/storage.manager";
import { Logger } from "@utils/logger";
import { computeElapsedTimeAsync } from "@utils/performance";
import * as OutBoxDAL from "@dal/outbox.dal";
import * as ReleaseDAL from "@dal/release.dal";
import * as ArtifactDAL from "@dal/artifact.dal";
import { OutBoxEvent, OutBoxState } from "@models/outbox.model";

function _prepareMessage({ event }: Pick<FileStorageInputData, "event">): string {
  const messages: Record<string, string> = {
    delete: "File has been soft deleted!",
    restore: "File has been restored",
  };

  return messages[event];
}

async function _restoreRecords({
  data: { projectId, outboxId },
}: Job<FileStorageInputData, Partial<FileStorageOutputData>>): Promise<boolean> {
  try {
    const releases = await ReleaseDAL.findReleasesByProjectId(projectId);

    for (const release of releases) {
      const artifact = await ArtifactDAL.findArtifactByReleaseId(release.getId());

      if (!artifact) {
        continue;
      }

      const isFileOnTrashDirectory = StorageManager.isFileOnDirectory(artifact.getFileName(), {
        onDirectory: "trash",
      });

      if (isFileOnTrashDirectory) {
        await StorageManager.moveToStorageDirectory(artifact.getFileName());
      }
    }
    await OutBoxDAL.updateOutboxState(outboxId, OutBoxState.PROCESSED);
  } catch (error) {
    Logger.error((error as Error).message);
    await OutBoxDAL.updateOutboxState(outboxId, OutBoxState.FAILED);
    return false;
  }
  return true;
}

async function _softDelete({
  data: { projectId, outboxId },
}: Job<FileStorageInputData, Partial<FileStorageOutputData>>): Promise<boolean> {
  try {
    const releases = await ReleaseDAL.findSoftDeletedReleasesByProjectId(projectId);

    for (const release of releases) {
      const artifact = await ArtifactDAL.findSoftDeletedArtifactByReleaseId(release.getId());

      if (!artifact) {
        continue;
      }

      const isFileOnStorageDirectory = StorageManager.isFileOnDirectory(artifact.getFileName(), {
        onDirectory: "storage",
      });

      if (isFileOnStorageDirectory) {
        await StorageManager.moveToTrashDirectory(artifact.getFileName());
      }
    }
    await OutBoxDAL.updateOutboxState(outboxId, OutBoxState.PROCESSED);
  } catch (error) {
    Logger.error((error as Error).message);
    await OutBoxDAL.updateOutboxState(outboxId, OutBoxState.FAILED);
    return false;
  }

  return true;
}

const worker = new StorageManagerWorker(
  STORAGE_MANAGER_QUEUE_NAME,
  async (
    job: Job<FileStorageInputData, Partial<FileStorageOutputData>>,
  ): Promise<Partial<FileStorageOutputData>> => {
    const { outboxId, event } = job.data;

    const isProcessed = await OutBoxDAL.findByOutboxId(outboxId, OutBoxState.PROCESSED);
    if (isProcessed) {
      return {
        message: "Already processed job!",
      };
    }

    let status = false;
    const elapsedTime = await computeElapsedTimeAsync(async () => {
      if (event === OutBoxEvent.DELETE) {
        Logger.info("Soft Deletion Started...");
        status = await _softDelete(job);
      } else if (event === OutBoxEvent.RESTORE) {
        Logger.info("File Restoration Started....");
        status = await _restoreRecords(job);
      } else {
        throw new Error("Unknown outbox event!");
      }
    });

    const preparedMessage = _prepareMessage(job.data);
    Logger.info(preparedMessage);

    return {
      elapsedTime: elapsedTime,
      message: preparedMessage,
      processStatus: status ? "success" : "failed",
      operation: event,
    };
  },
  {
    limiter: {
      max: 500,
      duration: 60 * 1000,
    },
    connection: RedisConnection,
    autorun: true,
    removeOnComplete: {
      age: 3600,
      count: 2000,
    },

    removeOnFail: {
      age: 24 * 3600,
      count: 5000,
    },
  },
);

worker.on("ready", () => {
  Logger.info("storage worker started!");
});

worker.on("active", (job, _) => {
  Logger.info(`job: ${job.id} is being processed!`);
});

worker.on("error", (error) => {
  Logger.error(error.message);
});

worker.on("failed", (_, error) => {
  Logger.error(error.message);
});

worker.on("completed", (job, _) => {
  Logger.info(`job: ${job.id} has been processed for outbox ${job.data.outboxId}`);
});
