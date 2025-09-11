import { ProjectDTO, VoyagerRequest } from "types";
import { ProjectService } from "@services/project";
import { Response } from "express";
import { inject, injectable } from "tsyringe";

@injectable()
export class ProjectController {
  constructor(
    @inject(ProjectService)
    private readonly _project: ProjectService,
  ) {}

  async postProject(
    request: VoyagerRequest<undefined, undefined, ProjectDTO>,
    response: Response,
  ) {
    try {
      await this._project.createProject(request.session.user!.publicID, request.body);
      response.redirect("/projects");
    } catch (error) {
      console.log(error);
      response.render("projects", {
        error_message: (error as Error).message.toString(),
      });
    }
  }

  async getProjects(request: VoyagerRequest, response: Response) {
    try {
      const projects = await this._project.getProjects(request.session.user!.publicID);
      response.render("projects", {
        projects: projects.length >= 0 ? projects : [],
        username: request.session.user!.username,
        email: request.session.user!.email,
        profile: "",
      });
    } catch (error) {
      console.log(error);
      response.render("projects", {
        error_message: (error as Error).message.toString(),
      });
    }
  }
}
