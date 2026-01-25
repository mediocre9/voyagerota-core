/* eslint-disable @typescript-eslint/no-misused-promises */
import { ProjectController } from "@controllers/web/project.controller";
import express from "express";
import { container } from "tsyringe";

const projectController = container.resolve(ProjectController);
export const projectWebRouter = express.Router();

projectWebRouter
  .route("/")
  .get(projectController.getProjects.bind(projectController))
  .post(projectController.postProject.bind(projectController))
  .delete(projectController.removeProject.bind(projectController));
