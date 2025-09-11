import { DeviceRegistryService } from "@services/device-registry";
import { NextFunction, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { injectable, inject } from "tsyringe";
import { DeviceDTO, VoyagerRequest } from "types";

interface DeviceRegistryResponse {
  message: string;
  code: number;
  reason: string;
}

@injectable()
export class DeviceController {
  constructor(
    @inject(DeviceRegistryService) private readonly _deviceRegistry: DeviceRegistryService
  ) {}

  public async registerDevice(
    request: VoyagerRequest<null, null, DeviceDTO>,
    response: Response<DeviceRegistryResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      await this._deviceRegistry.registerDevice(request.body);
      response.status(201).json({
        message: "Device registered successfully!",
        code: StatusCodes.CREATED,
        reason: getReasonPhrase(StatusCodes.CREATED),
      });
    } catch (error) {
      next(error);
    }
  }

  public async authenticate(
    request: VoyagerRequest<null, null, null, DeviceDTO>,
    response: Response<DeviceRegistryResponse>,
    next: NextFunction
  ) {
    try {
      await this._deviceRegistry.authenticate(request.query);
      response.status(StatusCodes.OK).json({
        message: "Device Authenticated!",
        reason: getReasonPhrase(StatusCodes.OK),
        code: StatusCodes.OK,
      });
    } catch (error) {
      next(error);
    }
  }
}
