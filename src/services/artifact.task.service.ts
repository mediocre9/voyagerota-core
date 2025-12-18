import * as ArtifactDAL from "@dal/artifact.dal";
import * as ReleaseDAL from "@dal/release.dal";
import { ArtifactTaskDTO } from "@schemas/artifact.schema";
import { ApiError } from "@utils/error";
import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { ArtifactQueueService, TaskCreatedData, TaskStatus } from "./artifact.queue.service";

// TODO Add processed | pending states in artifact table to enforce release promotion only to staging once ...
@injectable()
export class ArtifactTaskService {
  constructor(
    @inject(ArtifactQueueService)
    private readonly _queue: ArtifactQueueService
  ) {}

  public async createTask(dto: ArtifactTaskDTO): Promise<TaskCreatedData> {
    const { releaseId, filename } = dto;

    const release = await ReleaseDAL.findReleaseByPublicId(releaseId);
    if (!release) {
      throw new ApiError("releaseId Not Found!", StatusCodes.NOT_FOUND);
    }

    // !remove the explicit error but put it in documentation......
    const artifact = await ArtifactDAL.findArtifactByReleaseId(release.id!);
    if (!artifact) {
      throw new ApiError(
        "Draft releases cannot be processed! Please upload file to promote release as staging!",
        StatusCodes.BAD_REQUEST
      );
    }

    const job = await this._queue.putJob({
      releaseId: releaseId,
      filename: filename,
      hash: artifact.hash!,
    });

    return job;
  }

  public async getTaskStatus(jobId: string): Promise<TaskStatus> {
    const job = await this._queue.getJob(jobId);

    if (!job) {
      throw new ApiError("Task not found!", StatusCodes.NOT_FOUND);
    }

    const status = await this._queue.getCurrentJobStatus(jobId);
    const state = this._queue.getJobState(status);
    const jobData = await this._queue.getData(jobId);
    return { state: state, status: status, data: jobData };
  }
}
