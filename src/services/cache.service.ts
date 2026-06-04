import { redis } from "@config/redis.connection.config";
import * as Types from "../types";
import { injectable } from "tsyringe";

type MutexKey = { mutexKey: string };

type Channel = "staging" | "production";

type CacheData<T> = { cachedData: Types.Nullable<T>; cacheKey: string };

type CacheCreationStatus = { isCached: boolean; cacheKey: string };

type CacheInvalidationStatus = { isInvalidated: boolean; cacheKey: string };
type ChannelBasedCacheInvalidationStatus = {
  staging: { wasCached: boolean; key: Types.Nullable<string> };
  production: { wasCached: boolean; key: Types.Nullable<string> };
};

export abstract class CacheService {
  public async add(id: string, data: string): Promise<void> {
    const EXPIRATION = 4 * 3600; // 4hrs in seconds....
    const JITTER = Math.random() * (60 * 7); // 7 minutes jitter variation.....
    const TTL = Math.ceil(EXPIRATION + JITTER);
    await redis.set(id, data, "EX", TTL);
  }

  public async isEmpty(key: string): Promise<boolean> {
    return (await this.get(key)) === null;
  }

  public async isNotEmpty(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  public async get<T = string>(key: string): Promise<T> {
    const data = (await redis.get(key))!;
    return JSON.parse(data) as T;
  }

  public async remove(key: string): Promise<boolean> {
    return (await redis.del(key)) > 0;
  }
}

@injectable()
export class ReleaseCacheService extends CacheService {
  public async invalidateCache(key: string, channel: Channel): Promise<CacheInvalidationStatus> {
    const cacheKey = this._createChannelBasedCacheKey(key, channel);
    if (await this.isNotEmpty(cacheKey)) {
      await this.remove(cacheKey);
      return { isInvalidated: true, cacheKey: cacheKey };
    }
    return { isInvalidated: false, cacheKey: cacheKey };
  }

  public async invalidateCacheChannels(key: string): Promise<ChannelBasedCacheInvalidationStatus> {
    const stagingChannelKey = this._createChannelBasedCacheKey(key, "staging");
    const isStagingCached = await this.isNotEmpty(stagingChannelKey);
    if (isStagingCached) {
      await this.remove(stagingChannelKey);
    }

    const productionChannelKey = this._createChannelBasedCacheKey(key, "production");
    const isProductionCached = await this.isNotEmpty(productionChannelKey);
    if (isProductionCached) {
      await this.remove(productionChannelKey);
    }

    return {
      staging: {
        wasCached: isStagingCached,
        key: isStagingCached ? stagingChannelKey : null,
      },
      production: {
        wasCached: isProductionCached,
        key: isProductionCached ? productionChannelKey : null,
      },
    };
  }

  public async addChannelBased<T>(
    key: string,
    data: T,
    channel: Channel,
  ): Promise<CacheCreationStatus> {
    const cacheKey = this._createChannelBasedCacheKey(key, channel);
    if (await this.isEmpty(cacheKey)) {
      await this.add(cacheKey, JSON.stringify(data));
      return { isCached: true, cacheKey: cacheKey };
    }
    return { isCached: false, cacheKey: cacheKey };
  }

  public async getChannelBased<T>(key: string, channel: Channel): Promise<CacheData<T>> {
    const cacheKey = this._createChannelBasedCacheKey(key, channel);
    if (await this.isNotEmpty(cacheKey)) {
      return { cachedData: await this.get<T>(cacheKey), cacheKey: cacheKey };
    }
    return { cachedData: null, cacheKey: cacheKey };
  }

  public async acquireMutexLock({ mutexKey }: MutexKey): Promise<boolean> {
    const TTL = 20; // in seconds....
    const mutexLockKey = `LOCK:${mutexKey}`;
    return (await redis.set(mutexLockKey, "ACQUIRED", "EX", TTL, "NX")) === "OK";
  }

  public async releaseMutexLock({ mutexKey }: MutexKey): Promise<boolean> {
    const mutexLockKey = `LOCK:${mutexKey}`;
    return await this.remove(mutexLockKey);
  }

  private _createChannelBasedCacheKey(key: string, channel: Channel): string {
    const cacheKey = `${key}:${channel}`;
    return cacheKey;
  }
}
