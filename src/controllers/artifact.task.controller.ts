import { ArtifactTaskDTO, ArtifactTaskSchema } from "@schemas/artifact.schema";
import { ArtifactTaskService } from "@services/artifact.task.service";
import { NextFunction, Request, Response } from "express";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";

/**
 * !Investigate the failing Artifact Queue Service...
 * ![PRI-0]
 * * FIXED: problem was related to different QUEUE_NAME....
 */
@injectable()
export class ArtifactTaskController {
  constructor(
    @inject(ArtifactTaskService)
    private readonly _task: ArtifactTaskService
  ) {}

  async createTask(
    request: Request<undefined, undefined, ArtifactTaskDTO>,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dto = await ArtifactTaskSchema.parseAsync(request.body);
      const { id, timestamps } = await this._task.createTask(dto);
      response.status(StatusCodes.ACCEPTED).json({
        message: "Artifact task has been submitted!",
        task: {
          id,
          timestamps,
        },
        status: {
          reason: getReasonPhrase(StatusCodes.ACCEPTED),
          code: StatusCodes.ACCEPTED,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getTaskStatus(
    request: Request<undefined, undefined, undefined, { id: string }>,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { state, status, data } = await this._task.getTaskStatus(request.query.id);
      response.status(state.statusCode).json({
        message: state.message,
        task: {
          status: status,
          data: data,
        },
        status: {
          reason: getReasonPhrase(state.statusCode),
          code: state.statusCode,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
