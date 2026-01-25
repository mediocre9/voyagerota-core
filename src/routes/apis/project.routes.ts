/* eslint-disable @typescript-eslint/no-misused-promises */
import { ProjectController } from "@controllers/api/project.controller";
import express from "express";
import { container } from "tsyringe";

const projectController = container.resolve(ProjectController);
export const projectApiRouter = express.Router();

projectApiRouter
  .route("/projects")
  .get(projectController.getProjects.bind(projectController))
  .post(projectController.createProject.bind(projectController));

projectApiRouter
  .route("/projects/:projectId")
  .delete(projectController.removeProject.bind(projectController));
