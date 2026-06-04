import {
  ArtifactInspectionQueue,
  TaskArtifactInputData,
  TaskArtifactOutputData,
} from "@queues/artifact.queue";
import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { QueueBaseService, QueueBaseStates, QueueBaseStatusMessage } from "./queue.base.service";

export interface TaskArtifactStatusMessage {
  message: string;
  statusCode: StatusCodes;
}

export interface TaskArtifactResultData {
  id: string;
  timestamps: number;
}

export interface TaskArtifactStatus {
  status: TaskArtifactStatusMessage;
  state: QueueBaseStates;
  data: TaskArtifactOutputData;
}

@injectable()
export class ArtifactInspectionQueueService extends QueueBaseService<
  TaskArtifactInputData,
  TaskArtifactOutputData,
  TaskArtifactResultData
> {
  constructor(
    @inject(ArtifactInspectionQueue)
    private readonly _artifactQueue: ArtifactInspectionQueue,
  ) {
    super(_artifactQueue);
  }

  override async putJob(jobData: TaskArtifactInputData): Promise<TaskArtifactResultData> {
    const job = await this._artifactQueue.enQueueArtifact(jobData);
    return { id: job.id!, timestamps: job.timestamp };
  }

  public getJobStatusMessage(state: QueueBaseStates): QueueBaseStatusMessage {
    const states = new Map<QueueBaseStates, QueueBaseStatusMessage>([
      [
        QueueBaseStates.ACTIVE,
        {
          message: "Artifact build detection is being processed. Please wait....",
          statusCode: StatusCodes.ACCEPTED,
        },
      ],
      [
        QueueBaseStates.COMPLETED,
        {
          message: "Artifact build detection completed with results!",
          statusCode: StatusCodes.OK,
        },
      ],
      [
        QueueBaseStates.DELAYED,
        {
          message: "Artifact processing has been delayed!",
          statusCode: StatusCodes.ACCEPTED,
        },
      ],
      [
        QueueBaseStates.FAILED,
        {
          message: "Artifact processing failed!",
          statusCode: StatusCodes.OK,
        },
      ],
      [
        QueueBaseStates.WAITING,
        {
          message: "Artifact processing is in waiting mode.",
          statusCode: StatusCodes.ACCEPTED,
        },
      ],
      [
        QueueBaseStates.PRIORITIZED,
        {
          message: "PRIORITIZED........",
          statusCode: StatusCodes.ACCEPTED,
        },
      ],
      [
        QueueBaseStates.WAITING_CHILDREN,
        {
          message: "WAITING_CHILDREN........",
          statusCode: StatusCodes.ACCEPTED,
        },
      ],
      [QueueBaseStates.UNKNOWN, { message: "UNKNOWN.....", statusCode: StatusCodes.ACCEPTED }],
    ]);

    return states.get(state)!;
  }
}
