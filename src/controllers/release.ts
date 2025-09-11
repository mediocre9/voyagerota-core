import { ReleaseService } from "@services/release";
import { Response } from "express";
import { inject, injectable } from "tsyringe";
import { ReleaseDTO, VoyagerRequest } from "types";

type Param = {
  project_id: string;
};

@injectable()
export class ReleaseController {
  constructor(
    @inject(ReleaseService)
    private readonly _release: ReleaseService,
  ) {}

  async postRelease(
    request: VoyagerRequest<undefined, undefined, ReleaseDTO>,
    response: Response,
  ) {
    try {
      await this._release.preprocessReleaseArtifact(request.body);
      response.json({ message: "Content has been enqueued" });
    } catch (error) {
      response.json({
        error_message: (error as Error).message.toString(),
      });
    }
  }

  async getReleases(request: VoyagerRequest<Param>, response: Response) {
    try {
      const { project_id } = request.params;
      const releases = await this._release.getReleases(project_id);
      response.render("releases", {
        releases: releases.length > 0 ? releases : [],
      });
    } catch (error) {
      response.render("releases", {
        error_message: (error as Error).message.toString(),
      });
    }
  }
}
