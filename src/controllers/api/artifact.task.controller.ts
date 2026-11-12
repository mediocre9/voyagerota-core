import { ArtifactTaskDTO, ArtifactTaskSchema } from "@schemas/artifact.schema";
import { TaskIdPathParam, TaskIdPathParamSchema } from "@schemas/task.schema";
import { ArtifactInspectionTaskService } from "@services/artifact.task.service";
import { UserLocals } from "@middlewares/auth";
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
    @inject(ArtifactInspectionTaskService)
    private readonly _task: ArtifactInspectionTaskService,
  ) {}

  async createTask(
    request: Request<undefined, undefined, ArtifactTaskDTO>,
    response: Response<unknown, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dto = await ArtifactTaskSchema.parseAsync(request.body);
      const { id, timestamps } = await this._task.createTask(dto, response.locals.user);
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
    request: Request<TaskIdPathParam>,
    response: Response<unknown, UserLocals>,
    next: NextFunction,
  ): Promise<void> {
    try {
      const param = await TaskIdPathParamSchema.parseAsync(request.params);
      const { state, status, data } = await this._task.getTaskStatus(param, response.locals.user);
      response.status(status.statusCode).json({
        message: status.message,
        task: {
          state: state.toLowerCase(),
          data: data,
        },
        status: {
          reason: getReasonPhrase(status.statusCode),
          code: status.statusCode,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
