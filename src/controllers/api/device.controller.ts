import { DeviceStatusRegistryService } from "@services/device.registry.service";
import { NextFunction, Response, Request } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { injectable, inject } from "tsyringe";
import {
  DeviceDTO,
  DeviceSchema,
  ReleaseIdMacAddressPathParam,
  ReleaseIdMacAddressPathParamSchema,
} from "@schemas/device.schema";
import { DeviceLocals } from "@middlewares/device.auth";
import { DeviceRegistryResponse } from "../../types";
import { ReleaseIdPathParam, ReleaseIdPathParamSchema } from "@schemas/release.schema";

@injectable()
export class DeviceUpdateRegistryController {
  constructor(
    @inject(DeviceStatusRegistryService)
    private readonly _deviceStatusRegistry: DeviceStatusRegistryService,
  ) {}

  public async checkStatus(
    request: Request<ReleaseIdMacAddressPathParam>,
    response: Response<unknown, DeviceLocals>,
    next: NextFunction,
  ) {
    try {
      const { releaseId, macAddress } = await ReleaseIdMacAddressPathParamSchema.parseAsync(
        request.params,
      );
      const device = await this._deviceStatusRegistry.checkStatus(
        {
          releaseId: releaseId,
          macAddress: macAddress,
        },
        response.locals.project,
      );
      response.status(StatusCodes.OK).json({
        data: {
          ...device,
        },
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async update(
    request: Request<ReleaseIdPathParam, DeviceRegistryResponse, DeviceDTO>,
    response: Response<DeviceRegistryResponse, DeviceLocals>,
    next: NextFunction,
  ) {
    try {
      const { releaseId } = await ReleaseIdPathParamSchema.parseAsync(request.params);
      const { macAddress, status } = await DeviceSchema.parseAsync(request.body);
      const message = await this._deviceStatusRegistry.update(
        { releaseId },
        {
          macAddress: macAddress,
          status: status,
        },
        response.locals.project,
      );
      response.status(StatusCodes.OK).json({
        message: message,
        status: {
          reason: getReasonPhrase(StatusCodes.OK),
          code: StatusCodes.OK,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
