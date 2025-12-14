/**
 *
 * ! Reconsider the cache strategy algorithms again and find the optimal suitable solution...
 */
import { redis } from "@config/redis.connection.config";
import { injectable } from "tsyringe";

export enum SearchRotationMode {
  REAR,
  FORWARD,
}

/**
 * @deprecated This cache module has been deprecated!
 */
@injectable()
export class CacheManager {
  /**
   *
   * @param key record's PublicId should be used
   * @param value Any stringified object
   */
  public async prependToList(key: string, value: string): Promise<void> {
    await redis.lpush(key, value);
  }

  public async readList(
    key: string,
    startOffset: number = 0,
    endOffset: number = 5
  ): Promise<string[]> {
    return await redis.lrange(key, startOffset, endOffset);
  }

  public async isEmpty(key: string): Promise<boolean> {
    return (await redis.llen(key)) === 0;
  }

  public async getListCount(key: string): Promise<number> {
    return await redis.llen(key);
  }

  public async find(key: string): Promise<string[]> {
    return await redis.lrange(key, 0, -1);
  }

  public async removeFromList(
    key: string,
    value: string,
    mode: SearchRotationMode = SearchRotationMode.FORWARD
  ): Promise<number> {
    return await redis.lrem(key, mode, value);
  }
}

/**
 *
 * !Reconsider the approach in detail.....
 */
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

  async get(key: string): Promise<string> {
    return (await redis.get(key))!;
  }

  async evict(key: string): Promise<void> {
    await redis.del(key);
  }
}
