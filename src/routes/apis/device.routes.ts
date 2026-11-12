import { DeviceApiController } from "@controllers/api/device.controller";
import { ProjectDeviceController } from "@controllers/api/project.device.controller";
import { ArtifactReleaseController } from "@controllers/api/release.controller";
import { ArtifactStorageController } from "@controllers/api/artifact.storage.controller";
import { loadOwnedProject } from "@middlewares/auth";
import { authenticateDeviceToken, authenticateProjectKey } from "@middlewares/device.auth";
import express from "express";
import { container } from "tsyringe";

const deviceController = container.resolve(DeviceApiController);
const projectDeviceController = container.resolve(ProjectDeviceController);
const releaseController = container.resolve(ArtifactReleaseController);
const storageController = container.resolve(ArtifactStorageController);

// device api (VoyagerOTAClient).... mounted at /internal/api/v2....
export const deviceApiRouter = express.Router();

deviceApiRouter
  .route("/devices/register")
  .post(authenticateProjectKey, deviceController.register.bind(deviceController));

deviceApiRouter
  .route("/devices/reports")
  .post(authenticateDeviceToken, deviceController.report.bind(deviceController));

deviceApiRouter
  .route("/releases/latest")
  .get(
    authenticateDeviceToken,
    deviceController.trackChannel.bind(deviceController),
    releaseController.getLatestRelease.bind(releaseController),
  );

deviceApiRouter
  .route("/releases/:releaseId/artifacts/:artifactId/download")
  .get(authenticateDeviceToken, storageController.streamDownload.bind(storageController));

// dashboard api (voyagerota-web).... mounted at /api/v1/workspace/projects....
export const projectDeviceApiRouter = express.Router();

projectDeviceApiRouter.param("projectId", loadOwnedProject);
projectDeviceApiRouter.param(
  "deviceId",
  projectDeviceController.loadDevice.bind(projectDeviceController),
);

projectDeviceApiRouter
  .route("/:projectId/devices")
  .get(projectDeviceController.list.bind(projectDeviceController))
  .post(projectDeviceController.add.bind(projectDeviceController));

projectDeviceApiRouter
  .route("/:projectId/devices/:deviceId")
  .patch(projectDeviceController.rename.bind(projectDeviceController))
  .delete(projectDeviceController.remove.bind(projectDeviceController));

projectDeviceApiRouter
  .route("/:projectId/devices/:deviceId/approve")
  .post(projectDeviceController.approve.bind(projectDeviceController));

projectDeviceApiRouter
  .route("/:projectId/devices/:deviceId/revoke")
  .post(projectDeviceController.revoke.bind(projectDeviceController));

projectDeviceApiRouter
  .route("/:projectId/devices/:deviceId/reports")
  .get(projectDeviceController.reports.bind(projectDeviceController));

projectDeviceApiRouter
  .route("/:projectId/rollout")
  .get(projectDeviceController.rollout.bind(projectDeviceController));
