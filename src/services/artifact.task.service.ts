import * as ArtifactDAL from "@dal/artifact.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ArtifactTaskDTO } from "@schemas/artifact.schema";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import {
  ArtifactInspectionQueueService,
  TaskResultData,
  TaskStatus,
} from "./artifact.queue.service";
import { TaskIdPathParam } from "@schemas/task.schema";
import { Logger } from "@utils/logger";

@injectable()
export class ArtifactInspectionTaskService {
  constructor(
    @inject(ArtifactInspectionQueueService)
    private readonly _queue: ArtifactInspectionQueueService,
  ) {}

  public async createTask(dto: ArtifactTaskDTO): Promise<TaskResultData> {
    const { releaseId, filename } = dto;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("releaseId Not Found!", StatusCodes.NOT_FOUND);
    }

    const artifact = await ArtifactDAL.findPendingArtifact(release.getId(), filename);
    if (!artifact) {
      throw new ApiError("Artifact not found!", StatusCodes.NOT_FOUND);
    }

    if (artifact.isProcessed()) {
      throw new ApiError("This artifact has been already processed!", StatusCodes.CONFLICT);
    }

    const taskResult = await this._queue.putJob({
      artifactId: artifact.getPublicId(),
      releaseId: release.getPublicId(),
      releaseInternalId: release.getId(),
      filename: artifact.getFileName(),
    });

    return taskResult;
  }

  public async getTaskStatus(pathParam: TaskIdPathParam): Promise<TaskStatus> {
    const { taskId } = pathParam;
    const job = await this._queue.getJob(taskId);

    if (!job) {
      throw new ApiError("Task not found!", StatusCodes.NOT_FOUND);
    }

    const state = await this._queue.getCurrentJobState(taskId);
    const status = this._queue.getJobStatus(state);
    const jobData = await this._queue.getData(taskId);
    const taskStatus: TaskStatus = {
      status: status,
      state: state,
      data: jobData,
    };

    return taskStatus;
  }
}
