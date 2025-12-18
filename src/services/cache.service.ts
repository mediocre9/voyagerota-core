import { redis } from "@config/redis.connection.config";
import { injectable } from "tsyringe";

@injectable()
export class CacheService {
  public async add(id: string, data: string): Promise<void> {
    const EXPIRATION = 3600; // 1hr in seconds....
    const JITTER = Math.random() * 20;
    const TTL = Math.ceil(EXPIRATION + JITTER);
    await redis.set(id, data, "EX", TTL);
  }

  public async isEmpty(key: string): Promise<boolean> {
    return (await this.get(key)) === null;
  }

  public async get(key: string): Promise<string> {
    return (await redis.get(key))!;
  }

  public async evict(key: string): Promise<void> {
    await redis.del(key);
  }
}
