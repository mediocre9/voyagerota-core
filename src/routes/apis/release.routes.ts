import express from "express";
import { ReleaseInsightsController } from "@controllers/api/release.insights.controller";
import { ArtifactReleaseController } from "@controllers/api/release.controller";
import { ArtifactStorageController } from "@controllers/api/artifact.storage.controller";
import { container } from "tsyringe";
import { ArtifactStorageService, upload } from "@services/artifact.storage.service";
import { ArtifactInspectionQueue } from "@queues/artifact.queue";
import { ArtifactInspectionTaskService } from "@services/artifact.task.service";
import { ArtifactInspectionQueueService } from "@services/artifact.queue.service";
import { loadOwnedProject, loadProjectRelease } from "@middlewares/auth";

container.resolve(ArtifactInspectionQueueService);
container.resolve(ArtifactInspectionTaskService);
container.resolve(ArtifactInspectionQueue);
container.resolve(ArtifactStorageService);

const releaseController = container.resolve(ArtifactReleaseController);
const storageController = container.resolve(ArtifactStorageController);
const insightsController = container.resolve(ReleaseInsightsController);
export const releaseApiRouter = express.Router();

// every dashboard route is scoped to a project (and release) owned by the signed in user....
releaseApiRouter.param("projectId", loadOwnedProject);
releaseApiRouter.param("releaseId", loadProjectRelease);

releaseApiRouter
  .route("/:projectId/releases")
  .post(releaseController.createRelease.bind(releaseController))
  .get(releaseController.getAllReleases.bind(releaseController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId")
  .get(insightsController.detail.bind(insightsController))
  .patch(insightsController.updateChangelog.bind(insightsController))
  .delete(releaseController.removeRelease.bind(releaseController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId/preflight")
  .get(insightsController.preflight.bind(insightsController));

releaseApiRouter
  .route("/:projectId/releases/:releaseId/keep")
  .post(insightsController.keepRelease.bind(insightsController));

releaseApiRouter
  .route("/:projectId/settings")
  .get(insightsController.getSettings.bind(insightsController))
  .patch(insightsController.updateSettings.bind(insightsController));

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

releaseApiRouter
  .route("/:projectId/releases/:releaseId/artifacts/:artifactId/download")
  .get(storageController.streamProjectDownload.bind(storageController));
