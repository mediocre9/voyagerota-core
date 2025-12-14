import { DeviceRegistryService } from "@services/device.registry.service";
import { NextFunction, Response, Request } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { injectable, inject } from "tsyringe";
import { DeviceDTO } from "@schemas/device.schema";
import { DeviceRegistryResponse } from "types";

@injectable()
export class DeviceController {
  constructor(
    @inject(DeviceRegistryService) private readonly _deviceRegistry: DeviceRegistryService
  ) {}

  public async registerDevice(
    request: Request<null, null, DeviceDTO>,
    response: Response<DeviceRegistryResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      await this._deviceRegistry.registerDevice(request.body);
      response.status(StatusCodes.CREATED).json({
        message: "Device registered successfully!",
        status: {
          code: StatusCodes.CREATED,
          reason: getReasonPhrase(StatusCodes.CREATED),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async authenticate(
    request: Request<null, null, null, DeviceDTO>,
    response: Response<DeviceRegistryResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      await this._deviceRegistry.authenticate(request.query);
      response.status(StatusCodes.OK).json({
        message: "Device Authenticated!",
        status: {
          code: StatusCodes.OK,
          reason: getReasonPhrase(StatusCodes.OK),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
