import { ProjectController } from "@controllers/api/project.controller";
import { PlanController } from "@controllers/api/plan.controller";
import express from "express";
import { container } from "tsyringe";

const projectController = container.resolve(ProjectController);
const planController = container.resolve(PlanController);
export const projectApiRouter = express.Router();

projectApiRouter
  .route("/projects")
  .get(projectController.getProjects.bind(projectController))
  .post(projectController.createProject.bind(projectController));

projectApiRouter
  .route("/projects/:projectId")
  .patch(projectController.restoreProject.bind(projectController))
  .delete(projectController.removeProject.bind(projectController));

projectApiRouter.route("/plan").get(planController.getPlan.bind(planController));

projectApiRouter
  .route("/projects/:projectId/keep")
  .post(projectController.keepProject.bind(projectController));

// "keep this project" link from the dormant emails, the signed token is the proof....
export const keepApiRouter = express.Router();

keepApiRouter.route("/keep").post(projectController.keepProjectByToken.bind(projectController));

keepApiRouter.route("/plans").get(planController.getCatalog.bind(planController));
