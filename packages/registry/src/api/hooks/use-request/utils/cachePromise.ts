'use client';

type CachedKey = string | number;
const cachePromise = new Map<CachedKey, Promise<unknown>>();

/**
 * Get cached promise
 */
const getCachePromise = (cacheKey: CachedKey): Promise<unknown> | undefined => {
  return cachePromise.get(cacheKey);
};

/**
 * Set cache promise
 */
const setCachePromise = (cacheKey: CachedKey, promise: Promise<unknown>): void => {
  // Should cache the same promise, cannot be promise.finally
  // Because the promise.finally will change the reference of the promise
  cachePromise.set(cacheKey, promise);

  // no use promise.finally for compatibility
  promise
    .then((res) => {
      cachePromise.delete(cacheKey);
      return res;
    })
    .catch(() => {
      cachePromise.delete(cacheKey);
    });
};

export {getCachePromise, setCachePromise};
