/* eslint-disable @typescript-eslint/no-misused-promises */
import { ArtifactTaskController } from "@controllers/api/artifact.task.controller";
import { container } from "tsyringe";
import express from "express";

export const taskApiRouter = express.Router();
const artifactTaskController = container.resolve(ArtifactTaskController);

taskApiRouter.route("/").post(artifactTaskController.createTask.bind(artifactTaskController));

taskApiRouter
  .route("/:taskId/status")
  .get(artifactTaskController.getTaskStatus.bind(artifactTaskController));
