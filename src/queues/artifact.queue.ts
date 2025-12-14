import { Job, Queue } from "bullmq";
import { redis as RedisConnection } from "@config/redis.connection.config";
import { nanoid } from "nanoid";

export const ARTIFACT_QUEUE_NAME = "artifact-signature-queue";

export const DEAD_LETTER_QUEUE_NAME = "dead-letter-queue";

export interface QueueInputData {
  releaseId: string;
  filename: string;
  hash: string;
}

export interface QueueOutputData {
  id: string;
  releaseId: string;
  signature: string;
  publicKey: string;
}

// TODO Implement DLQ (Dead letter Queue) as well
// TODO attach it to the winston error logging profile for auditing and monitoring...
// * need better backoff strategy algorithm....
// * understand backoff strategies in detail....
// * current approach is Jitter-Exponential BackOff Strategy Algorithm
export class ArtifactSignatureQueue extends Queue<QueueInputData, QueueOutputData> {
  constructor() {
    super(ARTIFACT_QUEUE_NAME, {
      connection: RedisConnection,
      defaultJobOptions: {
        attempts: 3,
        delay: 10 * 1000,
        backoff: { type: "exponential", delay: 1000, jitter: 0.3 },
      },
    });
  }

  public async enQueueArtifact(
    data: QueueInputData
  ): Promise<Job<QueueInputData, QueueOutputData>> {
    const jobId = nanoid();
    const jobName = `artifact-queue:${data.filename}-${Date.now().valueOf()}`;

    return await this.add(jobName, data, { jobId: jobId });
  }
}

// TODO implement later with better strategy....
export class DeadLetterQueue extends Queue {
  constructor() {
    super(DEAD_LETTER_QUEUE_NAME, {
      connection: RedisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2 * 1000,
          jitter: 0.3,
        },
      },
    });
  }

  public enQueue() {
    throw new Error("Method not implemented yet!");
  }
}
