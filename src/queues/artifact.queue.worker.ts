import { redis as RedisConnection } from "@config/redis.connection.config";
import { Logger } from "@utils/logger";
import { Job, Worker } from "bullmq";
import * as crypto from "node:crypto";
import * as FileSignatureQueue from "./artifact.queue";

class DigitalSignature {
  public static generateKeys(): crypto.KeyPairSyncResult<string, string> {
    return crypto.generateKeyPairSync("rsa", {
      modulusLength: 768,
      privateKeyEncoding: {
        format: "pem",
        type: "pkcs8",
        passphrase: "signature-secret", // !put it in .env later....
        cipher: "aes-256-cbc",
      },
      publicKeyEncoding: {
        format: "pem",
        type: "spki",
      },
    } as crypto.RSAPSSKeyPairOptions<"pem", "pem">);
  }

  public static createSignature(privateKey: string, hash: string): string {
    const signer = crypto.createSign("SHA256");
    signer.write(hash);
    signer.end();

    const signature = signer.sign({ key: privateKey, passphrase: "signature-secret" }, "hex");
    return signature;
  }
}

const worker = new Worker(
  FileSignatureQueue.ARTIFACT_QUEUE_NAME,
  async (
    job: Job<FileSignatureQueue.QueueInputData, FileSignatureQueue.QueueOutputData>
  ): Promise<FileSignatureQueue.QueueOutputData> => {
    const { privateKey, publicKey } = DigitalSignature.generateKeys();
    const signature = DigitalSignature.createSignature(privateKey, job.data.hash);

    const output: FileSignatureQueue.QueueOutputData = {
      id: job.id!,
      releaseId: job.data.releaseId,
      signature,
      publicKey,
    };

    return Promise.resolve(output);
  },
  {
    limiter: {
      max: 50, // should be later consider at prod....
      duration: 60 * 1000, // same with this....
    },
    connection: RedisConnection,
    autorun: true,
    removeOnComplete: {
      age: 3600,
      count: 2000,
    },

    removeOnFail: {
      age: 24 * 3600,
      count: 5000,
    },
  }
);

worker.on("ready", () => {
  Logger.info("worker started!");
});

worker.on("active", () => {
  Logger.info("worker processing now!");
});

worker.on("error", (error) => {
  Logger.error(error.message);
});

worker.on("failed", (_, error) => {
  Logger.error(error.message);
});

worker.on("completed", () => {
  Logger.info("worker completed!");
});
