'use client';

import {useEffect, useRef} from 'react';
import type {Plugin} from '../types';
import type {CachedData} from '../utils/cache';
import {getCache, setCache} from '../utils/cache';
import {getCachePromise, setCachePromise} from '../utils/cachePromise';
import {subscribe, trigger} from '../utils/cacheSubscribe';

/**
 * Cache plugin for useRequest
 * Provides caching functionality with SWR support
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useCachePlugin: Plugin<any, unknown[]> = (
  fetchInstance,
  {
    cacheKey,
    cacheTime = 5 * 60 * 1000,
    staleTime = 0,
    setCache: customSetCache,
    getCache: customGetCache,
  }
) => {
  const unSubscribeRef = useRef<(() => void) | undefined>(undefined);

  const currentPromiseRef = useRef<Promise<unknown> | undefined>(undefined);

  const _setCache = (key: string, cachedData: CachedData) => {
    if (customSetCache) {
      customSetCache(cachedData);
    } else {
      setCache(key, cacheTime, cachedData);
    }
  };

  const _getCache = (key: string): CachedData | undefined => {
    if (customGetCache) {
      return customGetCache(key);
    }
    return getCache(key);
  };

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    // get data from cache when init
    const cacheData = _getCache(cacheKey);
    if (cacheData && Object.hasOwnProperty.call(cacheData, 'data')) {
      fetchInstance.state.data = cacheData.data;
      fetchInstance.state.params = cacheData.params as unknown[];
      if (staleTime === -1 || Date.now() - cacheData.time <= staleTime) {
        fetchInstance.state.loading = false;
      }
    }

    // subscribe same cachekey update, trigger update
    unSubscribeRef.current = subscribe(cacheKey, (data) => {
      fetchInstance.setState({data});
    });

    return () => {
      unSubscribeRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cacheKey) {
    return {};
  }

  return {
    onBefore: () => {
      const cacheData = _getCache(cacheKey);

      if (!cacheData || !Object.hasOwnProperty.call(cacheData, 'data')) {
        return {};
      }

      // If the data is fresh, stop request
      if (staleTime === -1 || Date.now() - cacheData.time <= staleTime) {
        return {
          loading: false,
          data: cacheData?.data,
          error: undefined,
          returnNow: true,
        };
      } else {
        // If the data is stale, return data, and request continue
        return {
          data: cacheData?.data,
          error: undefined,
        };
      }
    },
    onRequest: (service, args) => {
      let servicePromise = getCachePromise(cacheKey);

      // If has servicePromise, and is not trigger by self, then use it
      if (servicePromise && servicePromise !== currentPromiseRef.current) {
        return {servicePromise};
      }

      servicePromise = service(...args);
      currentPromiseRef.current = servicePromise;
      setCachePromise(cacheKey, servicePromise);
      return {servicePromise};
    },
    onSuccess: (data, params) => {
      if (cacheKey) {
        // cancel subscribe, avoid trigger self
        unSubscribeRef.current?.();
        _setCache(cacheKey, {
          data,
          params,
          time: Date.now(),
        });
        // 触发其他订阅者更新
        trigger(cacheKey, data);
        // resubscribe
        unSubscribeRef.current = subscribe(cacheKey, (d) => {
          fetchInstance.setState({data: d});
        });
      }
    },
    onMutate: (data) => {
      if (cacheKey) {
        // cancel subscribe, avoid trigger self
        unSubscribeRef.current?.();
        _setCache(cacheKey, {
          data,
          params: fetchInstance.state.params,
          time: Date.now(),
        });
        // 触发其他订阅者更新
        trigger(cacheKey, data);
        // resubscribe
        unSubscribeRef.current = subscribe(cacheKey, (d) => {
          fetchInstance.setState({data: d});
        });
      }
    },
  };
};

export default useCachePlugin;
