import {
  TelemetryRegistryService,
  TelemetryTopicService,
} from "@services/telemetry.registry.service";
import { NextFunction, Response, Request } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { ProjectIdQueryParam } from "@schemas/project.schema";
import { TelemetryIdAndTopicDTO } from "@schemas/telemetry.schema";
import { inject, injectable } from "tsyringe";
import {
  TelemetryRegistryResponse,
  TelemetryTopicCreationResponse,
  TelemetryTopicUpdateResponse,
  TelemetryUserAuthResponse,
} from "../../types";

@injectable()
export class TelemetryRegistryController {
  constructor(
    @inject(TelemetryRegistryService) private readonly _registryService: TelemetryRegistryService,
    @inject(TelemetryTopicService) private readonly _topicService: TelemetryTopicService,
  ) {}

  public async createTopic(
    request: Request<undefined, undefined, TelemetryIdAndTopicDTO>,
    response: Response<TelemetryTopicCreationResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      await this._topicService.createTopic(request.body);
      response.status(StatusCodes.CREATED).json({
        message: "Topic created succesfully!",
        status: {
          reason: getReasonPhrase(StatusCodes.CREATED),
          code: StatusCodes.CREATED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateTopic(
    request: Request<undefined, undefined, TelemetryIdAndTopicDTO>,
    response: Response<TelemetryTopicUpdateResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      await this._topicService.updateTopic(request.body);
      response.status(StatusCodes.OK).json({
        message: "Topic has been updated!",
        status: {
          code: StatusCodes.OK,
          reason: getReasonPhrase(StatusCodes.OK),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // TODO Investigate the public IDs
  public async enableTelemetry(
    request: Request<undefined, undefined, undefined, ProjectIdQueryParam>,
    response: Response<TelemetryRegistryResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = await this._registryService.enableTelemetry(request.query);
      response.status(StatusCodes.CREATED).json({
        publicId: id.toString(), // added .toString() to remove linter warning investigate later....
        message: "Telemetry service has been enabled!",
        status: {
          reason: getReasonPhrase(StatusCodes.CREATED),
          code: StatusCodes.CREATED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async createUserOnBroker(
    request: Request<undefined, undefined, undefined, ProjectIdQueryParam>,
    response: Response<TelemetryUserAuthResponse>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await this._registryService.registerUserOnBroker(request.query);
      response.status(StatusCodes.CREATED).json({
        message: "Telemetry service has been registered!",
        payload: {
          ...user,
        },
        status: {
          reason: getReasonPhrase(StatusCodes.CREATED),
          code: StatusCodes.CREATED,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
