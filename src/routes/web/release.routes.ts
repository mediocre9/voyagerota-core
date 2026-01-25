/* eslint-disable @typescript-eslint/no-misused-promises */

import express from "express";
import { ArtifactReleaseController } from "@controllers/web/release.controller";
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
const fileUploadController = container.resolve(ArtifactStorageController);
export const releaseWebRouter = express.Router();

releaseWebRouter
  .route("/:projectId/releases")

  .get(releaseController.getReleases.bind(releaseController));

releaseWebRouter
  .route("/:releaseId/uploads")
  .post(upload.single("binaryFile"), fileUploadController.upload.bind(fileUploadController));

releaseWebRouter
  .route("/:releaseId/uploads/:artifactId")
  .delete(fileUploadController.deleteBlob.bind(fileUploadController));

releaseWebRouter
  .route("/:releaseId/downloads/:artifactId")
  .get(fileUploadController.streamDownload.bind(fileUploadController));
