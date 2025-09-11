import { redis as connection } from "@config/redis-connection";
import { Queue } from "bullmq";

type EmailType = "verification" | "reset-password";

export type JobOtpTask = {
  email: string;
  username: string;
  code: string;
  type: EmailType;
};

export interface IEmailQueue<T> {
  enqueue(data: T): Promise<void>;
}

export const QUEUE_NAME: string = "email-queue";
export class EmailQueue extends Queue<JobOtpTask> implements IEmailQueue<JobOtpTask> {
  constructor() {
    super(QUEUE_NAME, { connection });
  }

  public async enqueue(job: JobOtpTask): Promise<void> {
    const { email, username, code, type } = job;
    const jobName = `${type}-${email}:${Date.now()}`;

    const jobData: JobOtpTask = {
      email,
      username,
      code,
      type,
    };
    await this.add(jobName, jobData);
  }
}
