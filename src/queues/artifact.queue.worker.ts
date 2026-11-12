import { db } from "@config/db.config";
import { redis as RedisConnection } from "@config/redis.connection.config";
import * as ArtifactDAL from "@dal/artifact.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ArtifactBuildStatus } from "@models/artifact.model";
import { StorageManager } from "@services/storage.manager";
import { Logger } from "@utils/logger";
import { computeElapsedTimeAsync } from "@utils/performance";
import { Worker as ArtifactInspectionWorker, Job, UnrecoverableError } from "bullmq";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as ArtifactQueue from "./artifact.queue";

const ___VYGR_STAGING_MARKER___ = "$2y$10$BsbB6jZbeQKLLnsnvGRJfOmGuG2Co0/LEDR4xO0Khnlvvm57c6Tai";
const ___VYGR_PRODUCTION_MARKER___ = "$2y$10$DX0bqDwfQtWJkBPgiXHVqOcbjOoX5i9cRHxSTgK3xgjTHpy5EGNbO";

const token = new Map<ArtifactBuildStatus, string>([
  ["staging-build", ___VYGR_STAGING_MARKER___],
  ["production-build", ___VYGR_PRODUCTION_MARKER___],
]);

type VersionMatchStatus = "matched" | "not-matched";

// VoyagerOTAClient 6 embeds "VYGR_FW_VERSION:<CURRENT_FIRMWARE_VERSION>;" in the binary....
const ___VYGR_VERSION_MARKER___ = /VYGR_FW_VERSION:([0-9A-Za-z.+-]{1,32});/;

type BuildInspectionResult = {
  buildStatus: ArtifactBuildStatus;
  versionMatchStatus: VersionMatchStatus;
  releaseVersion: string;
  binaryVersion: string | null;
};

function _escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// exact version from the SDK marker, otherwise fall back to looking for the version text
// with boundaries so 1.0.1 doesn't match inside 11.0.1 or 1.0.10....
function _matchBinaryVersion(
  contents: string,
  releaseVersion: string,
): { versionMatchStatus: VersionMatchStatus; binaryVersion: string | null } {
  const marker = ___VYGR_VERSION_MARKER___.exec(contents);
  if (marker) {
    const binaryVersion = marker[1];
    return {
      versionMatchStatus: binaryVersion === releaseVersion ? "matched" : "not-matched",
      binaryVersion,
    };
  }

  const pattern = new RegExp(`(?<![0-9.])${_escapeRegExp(releaseVersion)}(?![0-9]|\\.[0-9])`);
  return {
    versionMatchStatus: pattern.test(contents) ? "matched" : "not-matched",
    binaryVersion: null,
  };
}

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
    // the release was deleted while queued, retrying can't fix that....
    throw new UnrecoverableError("Release not found!");
  }

  const releaseVersion = release.getVersion();
  const { versionMatchStatus, binaryVersion } = _matchBinaryVersion(contents, releaseVersion);

  return {
    buildStatus: status,
    versionMatchStatus: versionMatchStatus,
    releaseVersion: releaseVersion,
    binaryVersion: binaryVersion,
  };
}

function _prepareBuildMessages(
  buildMessage: ArtifactBuildStatus,
  versionMessage: VersionMatchStatus,
  versions: { releaseVersion: string; binaryVersion: string | null },
): { buildMessage: string; versionMessage: string } {
  const buildMessages: Record<ArtifactBuildStatus, string> = {
    "production-build": "Passed: Production channel build found!",
    "staging-build":
      "Failed: Staging channel build found! Only production channel build is allowed!",
    "unknown-build": "Failed: Unknown build type found! Only production channel build is allowed!",
  };

  const versionMessages: Record<VersionMatchStatus, string> = {
    "not-matched": versions.binaryVersion
      ? `Failed: Binary is v${versions.binaryVersion} but the release is v${versions.releaseVersion}!`
      : `Failed: Binary version does not match with release version v${versions.releaseVersion}!`,
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
  const { buildStatus, versionMatchStatus, releaseVersion, binaryVersion } =
    await _inspectBinaryFile(job);

  const isBuildCorrect = buildStatus === "production-build" && versionMatchStatus === "matched";
  const elapsedTime = await computeElapsedTimeAsync(async () => {
    if (isBuildCorrect) {
      await _promoteReleaseToStagingState(job);
    } else {
      await _demoteReleaseToDraftState(job);
    }
  });

  const { buildMessage, versionMessage } = _prepareBuildMessages(buildStatus, versionMatchStatus, {
    releaseVersion,
    binaryVersion,
  });
  const isBuildPassed = buildStatus === "production-build";
  const result: ArtifactQueue.TaskArtifactOutputData = {
    artifactId: job.data.artifactId,
    artifactStatus: isBuildCorrect ? "accepted" : "rejected",
    buildStatus: buildStatus,
    versionMatchStatus: versionMatchStatus,
    releaseVersion: releaseVersion,
    binaryVersion: binaryVersion,
    matchResults: {
      buildStatusMessage: buildMessage,
      versionMatchMessage: versionMessage,
    },
    // kept for clients reading the earlier result shape....
    detectedBinary: buildStatus,
    message: !isBuildPassed
      ? buildMessage
      : versionMatchStatus === "not-matched"
        ? versionMessage
        : buildMessage,
    elapsedTime: elapsedTime / 1000, // in seconds......
  };

  return result;
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
