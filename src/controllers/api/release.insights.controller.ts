import { ReleaseLocals, ProjectLocals } from "@middlewares/auth";
import * as ProjectDAL from "@dal/project.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ChangelogSchema, RolloutSettingsSchema } from "@schemas/release.schema";
import { DeviceService, rolloutSettings } from "@services/device.service";
import { ArtifactReleaseService } from "@services/release.service";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";

const status = (code: StatusCodes) => ({ reason: getReasonPhrase(code), code });

// release detail, promotion preflight, changelog edits and rollout settings for the dashboard....
@injectable()
export class ReleaseInsightsController {
  constructor(
    @inject(DeviceService) private readonly _devices: DeviceService,
    @inject(ArtifactReleaseService) private readonly _release: ArtifactReleaseService,
  ) {}

  async detail(_: Request, response: Response<unknown, ReleaseLocals>, next: NextFunction) {
    try {
      const { project, release } = response.locals;
      const [withArtifact, devices, rollout] = await Promise.all([
        ReleaseDAL.findReleaseWithArtifact(release.getPublicId()),
        this._devices.releaseDevices(project, release),
        this._devices.rollout(project),
      ]);
      response.status(StatusCodes.OK).json({
        release: withArtifact!.toDTO(),
        rollout: rollout[release.getPublicId()],
        devices,
        status: status(StatusCodes.OK),
      });
    } catch (error) {
      next(error);
    }
  }

  async preflight(_: Request, response: Response<unknown, ReleaseLocals>, next: NextFunction) {
    try {
      const preflight = await this._devices.preflight(
        response.locals.project,
        response.locals.release,
      );
      response.status(StatusCodes.OK).json({ preflight, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }

  async updateChangelog(
    request: Request,
    response: Response<unknown, ReleaseLocals>,
    next: NextFunction,
  ) {
    try {
      const { changelog } = await ChangelogSchema.parseAsync(request.body);
      const release = await this._release.updateChangelog(response.locals.release, changelog);
      response.status(StatusCodes.OK).json({ release, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }

  getSettings(_: Request, response: Response<unknown, ProjectLocals>, next: NextFunction) {
    try {
      response
        .status(StatusCodes.OK)
        .json({
          settings: rolloutSettings(response.locals.project),
          status: status(StatusCodes.OK),
        });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(
    request: Request,
    response: Response<unknown, ProjectLocals>,
    next: NextFunction,
  ) {
    try {
      const dto = await RolloutSettingsSchema.parseAsync(request.body);
      const project = response.locals.project;
      await ProjectDAL.updateRolloutSettings(project.getId(), {
        failure_alert_count: dto.failureAlertCount,
        failure_alert_percent: dto.failureAlertPercent,
        auto_revoke: dto.autoRevoke,
      });
      const updated = await ProjectDAL.findProjectByInternalId(project.getId());
      response
        .status(StatusCodes.OK)
        .json({ settings: rolloutSettings(updated!), status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }
}
