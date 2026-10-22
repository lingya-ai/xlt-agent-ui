'use client';

type Timer = ReturnType<typeof setTimeout>;
type CachedKey = string | number;

export interface CachedData<TData = unknown, TParams = unknown> {
  data: TData;
  params: TParams;
  time: number;
}

interface RecordData<TData, TParams> extends CachedData<TData, TParams> {
  timer: Timer | undefined;
}

const cache = new Map<CachedKey, RecordData<unknown, unknown>>();

/**
 * Set cache data
 */
const setCache = <TData, TParams>(key: CachedKey, cacheTime: number, cachedData: CachedData<TData, TParams>): void => {
  const currentCache = cache.get(key);
  if (currentCache?.timer) {
    clearTimeout(currentCache.timer);
  }

  let timer: Timer | undefined = undefined;

  if (cacheTime > -1) {
    // if cache out, clear it
    timer = setTimeout(() => {
      cache.delete(key);
    }, cacheTime);
  }

  cache.set(key, {
    ...cachedData,
    timer,
  });
};

/**
 * Get cache data
 */
const getCache = <TData, TParams>(key: CachedKey): CachedData<TData, TParams> | undefined => {
  return cache.get(key) as CachedData<TData, TParams> | undefined;
};

/**
 * Clear cache data
 */
const clearCache = (key?: string | string[]): void => {
  if (key) {
    const cacheKeys = Array.isArray(key) ? key : [key];
    cacheKeys.forEach((cacheKey) => {
      const item = cache.get(cacheKey);
      if (item?.timer) {
        clearTimeout(item.timer);
      }
      cache.delete(cacheKey);
    });
  } else {
    cache.forEach((item) => {
      if (item.timer) {
        clearTimeout(item.timer);
      }
    });
    cache.clear();
  }
};

export {getCache, setCache, clearCache};
