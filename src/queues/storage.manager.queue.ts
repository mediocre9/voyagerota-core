import { Job, Queue } from "bullmq";
import { redis as RedisConnection } from "@config/redis.connection.config";
import { nanoid } from "nanoid";
import { OutBoxEvent } from "@models/outbox.model";

export const STORAGE_MANAGER_QUEUE_NAME = "storage-manager-queue-name";

export interface FileStorageInputData {
  outboxId: number;
  projectId: number;
  event: OutBoxEvent;
}

export interface FileStorageOutputData {
  message: string;
  operation: OutBoxEvent;
  processStatus: "failed" | "success";
  elapsedTime: number;
}

// alouette je te plumerai.......
// https://youtu.be/7IYVo4Y704E?si=Z3WWdkhtPd3a6WpD
export class StorageManagerQueue extends Queue<
  FileStorageInputData,
  Partial<FileStorageOutputData>
> {
  constructor() {
    super(STORAGE_MANAGER_QUEUE_NAME, {
      connection: RedisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000, jitter: 0.3 },
      },
    });
  }

  public async enQueueFile(
    data: FileStorageInputData,
  ): Promise<Job<FileStorageInputData, Partial<FileStorageOutputData>>> {
    const jobId = nanoid();
    const jobName = `outbox-${data.event}-event-job:${data.outboxId}-${Date.now().valueOf()}`;
    return await this.add(jobName, data, { jobId: jobId, delay: 5 * 1000 });
  }
}
