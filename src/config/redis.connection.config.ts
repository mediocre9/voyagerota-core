import { Logger } from "@utils/logger";
import { Redis } from "ioredis";

export const redis = new Redis({ maxRetriesPerRequest: null });

redis.on("ready", () => {
  Logger.info("Redis connection up!");
});

redis.on("error", (error) => {
  Logger.error("Redis Failed Error: %s", error.message);
});
