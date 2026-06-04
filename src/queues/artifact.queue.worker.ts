import { db } from "@config/db.config";
import { redis as RedisConnection } from "@config/redis.connection.config";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ArtifactBuildStatus } from "@models/artifact.model";
import { StorageManager } from "@services/storage.manager";
import { Logger } from "@utils/logger";
import { computeElapsedTimeAsync } from "@utils/performance";
import { Worker as ArtifactInspectionWorker, Job } from "bullmq";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as ArtifactQueue from "./artifact.queue";

const ___VYGR_STAGING_MARKER___ = "$2y$10$BsbB6jZbeQKLLnsnvGRJfOmGuG2Co0/LEDR4xO0Khnlvvm57c6Tai";
const ___VYGR_PRODUCTION_MARKER___ = "$2y$10$DX0bqDwfQtWJkBPgiXHVqOcbjOoX5i9cRHxSTgK3xgjTHpy5EGNbO";

const token = new Map<ArtifactBuildStatus, string>([
  ["staging-build", ___VYGR_STAGING_MARKER___],
  ["production-build", ___VYGR_PRODUCTION_MARKER___],
]);

async function _inspectFileForBuildStatus(
  job: Job<ArtifactQueue.TaskArtifactInputData, ArtifactQueue.TaskArtifactOutputData>,
): Promise<ArtifactBuildStatus> {
  const pathToFile = path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, job.data.filename);
  const contents = await fs.readFile(pathToFile, { encoding: "ascii" });

  let status: ArtifactBuildStatus = "unknown-build";
  if (contents.includes(token.get("staging-build")!)) {
    status = "staging-build";
  } else if (contents.includes(token.get("production-build")!)) {
    status = "production-build";
  }
  return status;
}

function _getBuildStatusMessage(status: ArtifactBuildStatus): string {
  const message: Record<ArtifactBuildStatus, string> = {
    "production-build": "Release has been promoted to staging state!",
    "staging-build": "Staging build detected! Only production build is allowed!",
    "unknown-build": "Unknown build type detected! Only production build is allowed!",
  };

  return message[status];
}

async function _markReleaseAsStaging(
  job: Job<ArtifactQueue.TaskArtifactInputData, ArtifactQueue.TaskArtifactOutputData>,
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
  job: Job<ArtifactQueue.TaskArtifactInputData, ArtifactQueue.TaskArtifactOutputData>,
): Promise<ArtifactQueue.TaskArtifactOutputData> {
  const status = await _inspectFileForBuildStatus(job);

  const elapsedTime = await computeElapsedTimeAsync(async () => {
    if (status === "production-build") {
      await _markReleaseAsStaging(job, status);
    }
  });

  const isNotProdBuild = status !== "production-build";
  if (isNotProdBuild) {
    await ArtifactDAL.deleteArtifactByReleaseId(job.data.releaseInternalId, null, true);
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

  return result as ArtifactQueue.TaskArtifactOutputData;
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
