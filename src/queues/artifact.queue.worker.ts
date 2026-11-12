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
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";

const ___VYGR_STAGING_MARKER___ = "$2y$10$BsbB6jZbeQKLLnsnvGRJfOmGuG2Co0/LEDR4xO0Khnlvvm57c6Tai";
const ___VYGR_PRODUCTION_MARKER___ = "$2y$10$DX0bqDwfQtWJkBPgiXHVqOcbjOoX5i9cRHxSTgK3xgjTHpy5EGNbO";

const token = new Map<ArtifactBuildStatus, string>([
  ["staging-build", ___VYGR_STAGING_MARKER___],
  ["production-build", ___VYGR_PRODUCTION_MARKER___],
]);

type VersionMatchStatus = "matched" | "not-matched";

type BuildInspectionResult = {
  buildStatus: ArtifactBuildStatus;
  versionMatchStatus: VersionMatchStatus;
};

async function _inspectBinaryFile(
  job: Job<ArtifactQueue.TaskArtifactInputData, ArtifactQueue.TaskArtifactOutputData>,
): Promise<BuildInspectionResult> {
  const pathToFile = path.join(StorageManager.DEFAULT_STORAGE_DIRECTORY_PATH, job.data.filename);
  const contents = await fs.readFile(pathToFile, { encoding: "ascii" });

  let status: ArtifactBuildStatus = "unknown-build";
  if (contents.includes(token.get("staging-build")!)) {
    status = "staging-build";
  } else if (contents.includes(token.get("production-build")!)) {
    status = "production-build";
  }

  const release = await ReleaseDAL.findReleaseByPublicId(job.data.releaseId);
  if (!release) {
    throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
  }

  const versionStatus: VersionMatchStatus = contents.includes(release.getVersion())
    ? "matched"
    : "not-matched";

  return {
    buildStatus: status,
    versionMatchStatus: versionStatus,
  };
}

function _prepareBuildMessages(
  buildMessage: ArtifactBuildStatus,
  versionMessage: VersionMatchStatus,
): { buildMessage: string; versionMessage: string } {
  const buildMessages: Record<ArtifactBuildStatus, string> = {
    "production-build": "Passed: Production channel build found!",
    "staging-build":
      "Failed: Staging channel build found! Only production channel build is allowed!",
    "unknown-build": "Failed: Unknown build type found! Only production channel build is allowed!",
  };

  const versionMessages: Record<VersionMatchStatus, string> = {
    "not-matched": "Failed: Binary version does not match with release version!",
    matched: "Passed: Release and binary version correct!",
  };

  return {
    buildMessage: buildMessages[buildMessage],
    versionMessage: versionMessages[versionMessage],
  };
}

async function _promoteReleaseToStagingState(
  job: Job<ArtifactQueue.TaskArtifactInputData, ArtifactQueue.TaskArtifactOutputData>,
): Promise<void> {
  const transaction = await db.transaction();
  try {
    await ArtifactDAL.updateArtifactStatus(
      job.data.releaseInternalId,
      job.data.filename,
      "staging-build",
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

async function _demoteReleaseToDraftState(
  job: Job<ArtifactQueue.TaskArtifactInputData, ArtifactQueue.TaskArtifactOutputData>,
): Promise<void> {
  const transaction = await db.transaction();
  try {
    await ReleaseDAL.updateReleaseChannel(job.data.releaseId, "draft", transaction);
    await ArtifactDAL.deleteArtifactByReleaseId(job.data.releaseInternalId, transaction, true);
    await transaction.commit();
    Logger.info("Release has been demoted to draft state!");
  } catch (error) {
    await transaction.rollback();
    Logger.error(error as string);
    throw error;
  }
}

async function _fileProcessor(
  job: Job<ArtifactQueue.TaskArtifactInputData, ArtifactQueue.TaskArtifactOutputData>,
): Promise<ArtifactQueue.TaskArtifactOutputData> {
  const { buildStatus, versionMatchStatus } = await _inspectBinaryFile(job);

  const isBuildCorrect = buildStatus === "production-build" && versionMatchStatus === "matched";
  const elapsedTime = await computeElapsedTimeAsync(async () => {
    if (isBuildCorrect) {
      await _promoteReleaseToStagingState(job);
    } else {
      await _demoteReleaseToDraftState(job);
    }
  });

  const { buildMessage, versionMessage } = _prepareBuildMessages(buildStatus, versionMatchStatus);
  const result = {
    artifactId: job.data.artifactId,
    artifactStatus: isBuildCorrect ? "accepted" : "rejected",
    buildStatus: buildStatus,
    matchResults: {
      buildStatusMessage: buildMessage,
      versionMatchMessage: versionMessage,
    },
    elapsedTime: elapsedTime / 1000, // in seconds......
  };

  return result as ArtifactQueue.TaskArtifactOutputData;
}

const worker = new ArtifactInspectionWorker(ArtifactQueue.ARTIFACT_QUEUE_NAME, _fileProcessor, {
  limiter: {
    max: 300, // 300 jobs per 5 minutes......
    duration: 5 * 60 * 1000, // 5 mins.....
  },
  connection: RedisConnection,
  autorun: true,
  removeOnComplete: {
    age: 3600,
    count: 2000,
  },
  concurrency: 5,
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
