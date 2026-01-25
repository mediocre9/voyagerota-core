/* eslint-disable @typescript-eslint/no-misused-promises */

import express from "express";
import { ArtifactReleaseController } from "@controllers/api/release.controller";
import { ArtifactStorageController } from "@controllers/api/artifact.storage.controller";
import { container } from "tsyringe";
import { ArtifactStorageService, upload } from "@services/artifact.storage.service";
import { ArtifactInspectionQueue } from "@queues/artifact.queue";
import { ArtifactInspectionTaskService } from "@services/artifact.task.service";
import { ArtifactInspectionQueueService } from "@services/artifact.queue.service";

container.resolve(ArtifactInspectionQueueService);
container.resolve(ArtifactInspectionTaskService);
container.resolve(ArtifactInspectionQueue);
container.resolve(ArtifactStorageService);

const releaseController = container.resolve(ArtifactReleaseController);
const storageController = container.resolve(ArtifactStorageController);
export const releaseApiRouter = express.Router();

releaseApiRouter
  .route("/:projectId/releases")
  .post(releaseController.createRelease.bind(releaseController))
  .get(releaseController.getAllReleases.bind(releaseController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId")
  .delete(releaseController.removeRelease.bind(releaseController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId/restore")
  .patch(releaseController.restoreRelease.bind(releaseController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId/artifacts/:artifactId/promote")
  .patch(releaseController.promote.bind(releaseController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId/artifacts/:artifactId/revoke")
  .patch(releaseController.revoke.bind(releaseController));

// artifact upload/download and delete release routes....
releaseApiRouter
  .route("/:projectId/releases/:releaseId/uploads")
  .post(upload.single("binaryFile"), storageController.upload.bind(storageController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId/artifacts/:artifactId")
  .delete(storageController.deleteBlob.bind(storageController));

// for end device clients....
export const deviceReleaseApiRouter = express.Router();
deviceReleaseApiRouter
  .route("/:releaseId/artifacts/:artifactId/download")
  .get(storageController.streamDownload.bind(storageController));

deviceReleaseApiRouter
  .route("/latest")
  .get(releaseController.getLatestRelease.bind(releaseController));
