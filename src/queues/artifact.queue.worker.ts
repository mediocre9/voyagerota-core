import { db } from "@config/db.config";
import { redis as RedisConnection } from "@config/redis.connection.config";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ArtifactBuildStatus } from "@models/artifact.model";
import { FileStorageOperation } from "@utils/common";
import { Logger } from "@utils/logger";
import { computeElapsedTimeAsync } from "@utils/performance";
import { Worker as ArtifactInspectionWorker, Job } from "bullmq";
import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as ArtifactQueue from "./artifact.queue";

const ___VYGR_DEV_MARKER___ = "$2y$10$BsbB6jZbeQKLLnsnvGRJfOmGuG2Co0/LEDR4xO0Khnlvvm57c6Tai";
const ___VYGR_PROD_MARKER___ = "$2y$10$DX0bqDwfQtWJkBPgiXHVqOcbjOoX5i9cRHxSTgK3xgjTHpy5EGNbO";

const token = new Map<ArtifactBuildStatus, string>([
  ["development-build", ___VYGR_DEV_MARKER___],
  ["production-build", ___VYGR_PROD_MARKER___],
]);

async function _inspectFileForBuildStatus(
  job: Job<ArtifactQueue.TaskInputData, ArtifactQueue.TaskOutputData>,
): Promise<ArtifactBuildStatus> {
  const pathToFile = path.join(FileStorageOperation.DEFAULT_FILE_STORAGE_PATH, job.data.filename);
  const contents = await fs.readFile(pathToFile, { encoding: "ascii" });

  let status: ArtifactBuildStatus = "unknown-build";
  if (contents.includes(token.get("development-build")!)) {
    status = "development-build";
  } else if (contents.includes(token.get("production-build")!)) {
    status = "production-build";
  }
  return status;
}

function _getBuildStatusMessage(status: ArtifactBuildStatus): string {
  const message: Record<ArtifactBuildStatus, string> = {
    "production-build": "Release has been promoted to staging state!",
    "development-build": "Development build detected! Only production build is allowed!",
    "unknown-build": "Unknown build type detected! Only production build is allowed!",
  };

  return message[status];
}

async function _markReleaseAsStaging(
  job: Job<ArtifactQueue.TaskInputData, ArtifactQueue.TaskOutputData>,
  status: ArtifactBuildStatus,
): Promise<void> {
  const transaction = await db.transaction();
  try {
    await ArtifactDAL.updateArtifactStatus(
      job.data.releaseInternalId,
      job.data.filename,
      status,
      transaction,
    );
    await ReleaseDAL.updateReleaseChannel(job.data.releaseId, "staging", transaction);
    await transaction.commit();
    Logger.info("Release has been promoted to staging state!");
  } catch (error) {
    await transaction.rollback();
    Logger.error(error as string);
    throw error;
  }
}

async function _fileProcessor(
  job: Job<ArtifactQueue.TaskInputData, ArtifactQueue.TaskOutputData>,
): Promise<ArtifactQueue.TaskOutputData> {
  const status = await _inspectFileForBuildStatus(job);

  const elapsedTime = await computeElapsedTimeAsync(async () => {
    if (status === "production-build") {
      await _markReleaseAsStaging(job, status);
    }
  });

  const FILE_STORAGE_PATH = path.join(
    FileStorageOperation.DEFAULT_FILE_STORAGE_PATH,
    job.data.filename,
  );

  const isNotProdBuild = status !== "production-build" && fsSync.existsSync(FILE_STORAGE_PATH);
  if (isNotProdBuild) {
    await ArtifactDAL.deleteArtifactByReleaseId(job.data.releaseInternalId, null, true);
    await FileStorageOperation.removePermanently(job.data.filename, "storage");
    Logger.info(`${status} - ${job.data.filename} has been permanently removed from worker!`);
  }

  const message = _getBuildStatusMessage(status);
  const result = {
    artifactId: job.data.artifactId,
    artifactStatus: status === "production-build" ? "accepted" : "rejected",
    detectedBinary: status,
    message: message,
    elapsedTime: elapsedTime / 1000, // in seconds......
  };

  return result as ArtifactQueue.TaskOutputData;
}

const worker = new ArtifactInspectionWorker(ArtifactQueue.ARTIFACT_QUEUE_NAME, _fileProcessor, {
  limiter: {
    max: 50, // should be later consider in prod....
    duration: 60 * 1000, // same with this....
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
});

worker.on("ready", () => {
  Logger.info("worker started!");
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
  Logger.info(`job: ${job.id} has been processed for ${job.data.filename}`);
});
