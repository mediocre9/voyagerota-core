/* eslint-disable @typescript-eslint/no-misused-promises */
import { ProjectController } from "@controllers/project.controller";
import express from "express";
import { container } from "tsyringe";

const projectController = container.resolve(ProjectController);
export const projectRouter = express.Router();

projectRouter
  .route("/")
  .get(projectController.getProjects.bind(projectController))
  .post(projectController.postProject.bind(projectController))
  .delete(projectController.removeProject.bind(projectController));
