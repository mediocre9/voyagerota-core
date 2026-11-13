import { ProjectLocals } from "@middlewares/auth";
import { ProjectDevice } from "@models/project.device.model";
import {
  DeviceCreateSchema,
  DeviceListQuerySchema,
  DeviceUpdateSchema,
} from "@schemas/device.schema";
import { DeviceService } from "@services/device.service";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";

type DeviceRouteLocals = ProjectLocals & { device: ProjectDevice };

const status = (code: StatusCodes) => ({ reason: getReasonPhrase(code), code });

@injectable()
export class ProjectDeviceController {
  constructor(
    @inject(DeviceService)
    private readonly _devices: DeviceService,
  ) {}

  // router.param handler for :deviceId, the device must belong to the loaded project....
  async loadDevice(
    _: Request,
    response: Response<unknown, Partial<DeviceRouteLocals>>,
    next: NextFunction,
    deviceId: string,
  ): Promise<void> {
    try {
      response.locals.device = await this._devices.findOrFail(response.locals.project!, deviceId);
      next();
    } catch (error) {
      next(error);
    }
  }

  async list(request: Request, response: Response<unknown, ProjectLocals>, next: NextFunction) {
    try {
      const { status: filter } = await DeviceListQuerySchema.parseAsync(request.query);
      const devices = await this._devices.list(response.locals.project, filter);
      response.status(StatusCodes.OK).json({ devices, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }

  async add(request: Request, response: Response<unknown, ProjectLocals>, next: NextFunction) {
    try {
      const dto = await DeviceCreateSchema.parseAsync(request.body);
      const device = await this._devices.add(response.locals.project, dto);
      response.status(StatusCodes.CREATED).json({ device, status: status(StatusCodes.CREATED) });
    } catch (error) {
      next(error);
    }
  }

  async rename(
    request: Request,
    response: Response<unknown, DeviceRouteLocals>,
    next: NextFunction,
  ) {
    try {
      const { name } = await DeviceUpdateSchema.parseAsync(request.body);
      const device = await this._devices.rename(response.locals.device, name);
      response.status(StatusCodes.OK).json({ device, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }

  async approve(_: Request, response: Response<unknown, DeviceRouteLocals>, next: NextFunction) {
    try {
      const device = await this._devices.approve(response.locals.device, response.locals.project);
      response.status(StatusCodes.OK).json({ device, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }

  async revoke(_: Request, response: Response<unknown, DeviceRouteLocals>, next: NextFunction) {
    try {
      const device = await this._devices.revoke(response.locals.device);
      response.status(StatusCodes.OK).json({ device, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }

  async remove(_: Request, response: Response<unknown, DeviceRouteLocals>, next: NextFunction) {
    try {
      await this._devices.remove(response.locals.device);
      response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
      next(error);
    }
  }

  async reports(_: Request, response: Response<unknown, DeviceRouteLocals>, next: NextFunction) {
    try {
      const reports = await this._devices.reports(response.locals.device);
      response.status(StatusCodes.OK).json({ reports, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }

  async rollout(_: Request, response: Response<unknown, ProjectLocals>, next: NextFunction) {
    try {
      const rollout = await this._devices.rollout(response.locals.project);
      response.status(StatusCodes.OK).json({ rollout, status: status(StatusCodes.OK) });
    } catch (error) {
      next(error);
    }
  }
}
