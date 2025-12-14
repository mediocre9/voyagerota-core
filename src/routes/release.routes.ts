/* eslint-disable @typescript-eslint/no-misused-promises */

import express from "express";
import { ArtifactReleaseController } from "@controllers/release.controller";
import { ArtifactStorageController } from "@controllers/artifact.storage.controller";
import { container } from "tsyringe";
import { ArtifactStorageService, upload } from "@services/artifact.storage.service";
import { ArtifactSignatureQueue } from "@queues/artifact.queue";
import { ArtifactTaskService } from "@services/artifact.task.service";
import { ArtifactQueueService } from "@services/artifact.queue.service";

container.resolve(ArtifactQueueService);
container.resolve(ArtifactTaskService);
container.resolve(ArtifactSignatureQueue);
container.resolve(ArtifactStorageService);

const releaseController = container.resolve(ArtifactReleaseController);
const fileUploadController = container.resolve(ArtifactStorageController);
export const releaseRouter = express.Router();

releaseRouter.route("/latest").get(releaseController.getLatestRelease.bind(releaseController));
releaseRouter
  .route("/")
  .post(releaseController.createRelease.bind(releaseController))
  .delete(releaseController.removeRelease.bind(releaseController))
  .patch(releaseController.promoteReleaseStatus.bind(releaseController))
  .get(releaseController.getAllReleases.bind(releaseController));

releaseRouter
  .route("/:releaseId/uploads")
  .post(upload.single("binaryFile"), fileUploadController.upload.bind(fileUploadController));

releaseRouter
  .route("/:releaseId/uploads/:artifactId")
  .delete(fileUploadController.deleteBlob.bind(fileUploadController));

releaseRouter
  .route("/:releaseId/downloads/:artifactId")
  .get(fileUploadController.streamDownload.bind(fileUploadController));
