import { ProjectController } from "@controllers/api/project.controller";
import { UsageController } from "@controllers/api/usage.controller";
import express from "express";
import { container } from "tsyringe";

const projectController = container.resolve(ProjectController);
const usageController = container.resolve(UsageController);
export const projectApiRouter = express.Router();

projectApiRouter
  .route("/projects")
  .get(projectController.getProjects.bind(projectController))
  .post(projectController.createProject.bind(projectController));

projectApiRouter
  .route("/projects/deleted")
  .get(projectController.getDeletedProjects.bind(projectController));

projectApiRouter
  .route("/projects/:projectId")
  .patch(projectController.restoreProject.bind(projectController))
  .delete(projectController.removeProject.bind(projectController));

projectApiRouter
  .route("/projects/:projectId/delete-check")
  .get(projectController.getDeleteCheck.bind(projectController));

projectApiRouter.route("/usage").get(usageController.getUsage.bind(usageController));

projectApiRouter
  .route("/projects/:projectId/keep")
  .post(projectController.keepProject.bind(projectController));

// "keep this project" link from the dormant emails, the signed token is the proof....
export const keepApiRouter = express.Router();

keepApiRouter.route("/keep").post(projectController.keepProjectByToken.bind(projectController));
