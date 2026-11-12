import { DeviceLocals, ProjectKeyLocals } from "@middlewares/device.auth";
import { DeviceRegisterSchema, DeviceReportSchema } from "@schemas/device.schema";
import { ReleaseChannelQueryParamSchema } from "@schemas/release.schema";
import { DeviceService } from "@services/device.service";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";

const status = (code: StatusCodes) => ({ reason: getReasonPhrase(code), code });

@injectable()
export class DeviceApiController {
  constructor(
    @inject(DeviceService)
    private readonly _devices: DeviceService,
  ) {}

  async register(
    request: Request,
    response: Response<unknown, ProjectKeyLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dto = await DeviceRegisterSchema.parseAsync(request.body);
      const result = await this._devices.register(response.locals.project, dto);

      if (result.status === "pending") {
        response.status(StatusCodes.ACCEPTED).json({
          message: "Device is waiting for approval in the VoyagerOTA dashboard.",
          device: { id: result.device.id, status: result.device.status },
          status: status(StatusCodes.ACCEPTED),
        });
        return;
      }

      response.status(StatusCodes.OK).json({
        message: "Device is approved.",
        device: { id: result.device.id, status: result.device.status },
        token: result.token,
        status: status(StatusCodes.OK),
      });
    } catch (error) {
      next(error);
    }
  }

  async report(
    request: Request,
    response: Response<unknown, DeviceLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dto = await DeviceReportSchema.parseAsync(request.body);
      await this._devices.report(response.locals.device, response.locals.project, dto);
      response.status(StatusCodes.CREATED).json({
        message: "Update report saved.",
        status: status(StatusCodes.CREATED),
      });
    } catch (error) {
      next(error);
    }
  }

  // remembers which channel the device follows, then hands over to the release controller....
  async trackChannel(
    request: Request,
    response: Response<unknown, DeviceLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { channel } = await ReleaseChannelQueryParamSchema.parseAsync(request.query);
      await this._devices.touch(response.locals.device, { channel });
      next();
    } catch (error) {
      next(error);
    }
  }
}
