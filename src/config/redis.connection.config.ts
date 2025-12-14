import { Redis } from "ioredis";

export const redis = new Redis({ maxRetriesPerRequest: null });

redis.on("ready", () => {
  console.log("Redis connection up!");
});

redis.on("error", (error) => {
  console.log("Redis Failed Error: ", error);
});
