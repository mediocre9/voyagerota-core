import { NullableOrUndefined } from "../types";
import { Job, JobState, Queue } from "bullmq";
import { StatusCodes } from "http-status-codes";

export enum QueueBaseStates {
  ACTIVE = "ACTIVE",
  DELAYED = "DELAYED",
  WAITING = "WAITING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  UNKNOWN = "UNKNOWN",
  PRIORITIZED = "PRIORITIZED",
  WAITING_CHILDREN = "WAITING_CHILDREN",
}

export interface QueueBaseStatusMessage {
  message: string;
  statusCode: StatusCodes;
}

export interface QueueBaseStatus {
  status: QueueBaseStatusMessage;
  state: QueueBaseStates;
}

/**
 * @description Simple abstract base queue service......
 * @param T - for input task data
 * @param U - for output task data
 * @param V - for task result data
 */
export abstract class QueueBaseService<T, U = unknown, V = unknown> {
  constructor(private _queue: Queue) {}

  abstract putJob(jobData: T): Promise<V>;

  async getJob(jobId: string): Promise<NullableOrUndefined<Job<unknown, U>>> {
    return await this._queue.getJob(jobId);
  }

  public async isJobCompleted(jobId: string): Promise<NullableOrUndefined<boolean>> {
    const job = await this._queue.getJob(jobId);
    return job?.isCompleted();
  }

  public async getData(jobId: string): Promise<NullableOrUndefined<U>> {
    const job = await this._queue.getJob(jobId);
    return job?.returnvalue as U;
  }

  public async getCurrentJobState(jobId: string): Promise<QueueBaseStates> {
    if (!(await this._isJobPresent(jobId))) {
      throw new Error("Job not Found!");
    }

    const state = await this._getJobState(jobId);
    switch (state) {
      case "active":
        return QueueBaseStates.ACTIVE;

      case "completed":
        return QueueBaseStates.COMPLETED;

      case "delayed":
        return QueueBaseStates.DELAYED;

      case "waiting":
        return QueueBaseStates.WAITING;

      case "failed":
        return QueueBaseStates.FAILED;

      case "prioritized":
        return QueueBaseStates.PRIORITIZED;

      case "waiting-children":
        return QueueBaseStates.WAITING_CHILDREN;

      default:
        return QueueBaseStates.UNKNOWN;
    }
  }

  private async _getJobState(jobId: string): Promise<JobState | "unknown"> {
    return await this._queue.getJobState(jobId);
  }

  private async _isJobPresent(jobId: string): Promise<boolean> {
    const job = await this._queue.getJob(jobId);
    return job !== undefined;
  }
}
