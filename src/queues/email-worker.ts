import { redis as redisConnection } from "@config/redis-connection";
import { UserVerificationOtpDTO } from "types";
import { QUEUE_NAME } from "@queues/email-queue";
import { Job, Worker } from "bullmq";
import { log } from "console";

async function mockEmailSender(otpInfo: UserVerificationOtpDTO): Promise<void> {
  log(`Job under process for : ${otpInfo.email}`);
  await new Promise<void>((resolve, _) => {
    setTimeout(() => {
      log(`Email processed with this code: ${otpInfo.code}`);
    }, 5 * 1000);
    resolve();
  });
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job<UserVerificationOtpDTO>) => {
    await mockEmailSender(job.data);
  },
  {
    connection: redisConnection,
    removeOnComplete: {
      age: 5 * 60 * 60,
    },
  }
);

worker.on("ready", () => {
  log("Email queue worker has been started!");
});
