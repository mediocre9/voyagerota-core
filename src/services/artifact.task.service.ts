import * as ArtifactDAL from "@dal/artifact.dal";
import * as ReleaseDAL from "@dal/release.dal";
import * as ProjectDAL from "@dal/project.dal";
import { User } from "@models/user.model";
import { TaskArtifactInputData } from "@queues/artifact.queue";
import { ArtifactTaskDTO } from "@schemas/artifact.schema";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import {
  ArtifactInspectionQueueService,
  TaskArtifactResultData,
  TaskArtifactStatus,
} from "./artifact.queue.service";
import { TaskIdPathParam } from "@schemas/task.schema";

@injectable()
export class ArtifactInspectionTaskService {
  constructor(
    @inject(ArtifactInspectionQueueService)
    private readonly _queue: ArtifactInspectionQueueService,
  ) {}

  public async createTask(dto: ArtifactTaskDTO, owner: User): Promise<TaskArtifactResultData> {
    const { releaseId, filename } = dto;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release || !(await this._isReleaseOwnedBy(release.getProjectForeignKeyId(), owner))) {
      throw new ApiError("Release not found!", StatusCodes.NOT_FOUND);
    }

    const artifact = await ArtifactDAL.findPendingArtifact(release.getId(), filename);

    if (!artifact) {
      throw new ApiError("Artifact not found!", StatusCodes.NOT_FOUND);
    }

    if (artifact.isProcessed() || artifact.isRevoked()) {
      throw new ApiError(
        `Task processing rejected as this artifact is ${artifact.getFileProcessState()}.`,
        StatusCodes.CONFLICT,
      );
    }

    const taskResult = await this._queue.putJob({
      artifactId: artifact.getPublicId(),
      releaseId: release.getPublicId(),
      releaseInternalId: release.getId(),
      filename: artifact.getFileName(),
    });

    return taskResult;
  }

  public async getTaskStatus(pathParam: TaskIdPathParam, owner: User): Promise<TaskArtifactStatus> {
    const { taskId } = pathParam;
    const job = await this._queue.getJob(taskId);

    if (!job) {
      throw new ApiError("Task not found!", StatusCodes.NOT_FOUND);
    }

    const { releaseInternalId } = job.data as TaskArtifactInputData;
    const release = await ReleaseDAL.getReleaseById(releaseInternalId);
    if (!release || !(await this._isReleaseOwnedBy(release.getProjectForeignKeyId(), owner))) {
      throw new ApiError("Task not found!", StatusCodes.NOT_FOUND);
    }

    const state = await this._queue.getCurrentJobState(taskId);
    const status = this._queue.getJobStatusMessage(state);
    const jobData = await this._queue.getData(taskId);
    const taskStatus: TaskArtifactStatus = {
      status: status,
      state: state,
      data: jobData!,
    };

    return taskStatus;
  }

  private async _isReleaseOwnedBy(projectInternalId: number, owner: User): Promise<boolean> {
    const project = await ProjectDAL.findProjectByInternalId(projectInternalId);
    return project !== null && project.getUserForeignKey() === owner.getId();
  }
}
