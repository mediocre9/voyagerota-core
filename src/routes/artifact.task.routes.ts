/* eslint-disable @typescript-eslint/no-misused-promises */
import { ArtifactTaskController } from "@controllers/artifact.task.controller";
import { container } from "tsyringe";
import express from "express";

export const artifactTaskRouter = express.Router();
const artifactTaskController = container.resolve(ArtifactTaskController);

artifactTaskRouter.route("/").post(artifactTaskController.createTask.bind(artifactTaskController));

artifactTaskRouter
  .route("/status")
  .get(artifactTaskController.getTaskStatus.bind(artifactTaskController));
