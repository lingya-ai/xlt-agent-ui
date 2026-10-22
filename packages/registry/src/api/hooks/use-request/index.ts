'use client';

import useAutoRunPlugin from './plugins/use-auto-run-plugin';
import useCachePlugin from './plugins/use-cache-plugin';
import useDebouncePlugin from './plugins/use-debounce-plugin';
import useLoadingDelayPlugin from './plugins/use-loading-delay-plugin';
import usePollingPlugin from './plugins/use-polling-plugin';
import useRefreshOnWindowFocusPlugin from './plugins/use-refresh-on-window-focus-plugin';
import useRetryPlugin from './plugins/use-retry-plugin';
import useThrottlePlugin from './plugins/use-throttle-plugin';
import type {Options, Plugin, Result, Service} from './types';
import useRequestImplement from './useRequestImplement';

/**
 * useRequest Hook
 *
 * 功能完整的 React 数据请求 Hook，支持：
 * - 自动/手动请求
 * - 轮询
 * - 防抖/节流
 * - 屏幕聚焦重新请求
 * - 错误重试
 * - Loading 延迟
 * - SWR (stale-while-revalidate)
 * - 缓存
 *
 * @example
 * ```ts
 * // 基础用法 - 自动请求
 * const { data, loading, error } = useRequest(getUser);
 *
 * // 手动请求
 * const { data, run } = useRequest(getUser, { manual: true });
 *
 * // 轮询
 * const { data } = useRequest(getStatus, { pollingInterval: 3000 });
 *
 * // 防抖
 * const { data, run } = useRequest(search, { debounceWait: 500 });
 *
 * // SWR + 缓存
 * const { data } = useRequest(getUser, {
 *   cacheKey: 'user',
 *   staleTime: 5000,
 * });
 * ```
 */
function useRequest<TData, TParams extends unknown[]>(
  service: Service<TData, TParams>,
  options?: Options<TData, TParams>,
  plugins?: Plugin<TData, TParams>[]
): Result<TData, TParams> {
  return useRequestImplement<TData, TParams>(service, options || {}, [
    ...(plugins || []),
    useDebouncePlugin,
    useLoadingDelayPlugin,
    usePollingPlugin,
    useRefreshOnWindowFocusPlugin,
    useThrottlePlugin,
    useAutoRunPlugin,
    useCachePlugin,
    useRetryPlugin,
  ] as Plugin<TData, TParams>[]);
}

export {useRequest};

/**
 * Export types
 */
export type {Options, Plugin, Result, Service} from './types';
export type {CachedData} from './utils/cache';

// Export cache utilities
export {clearCache} from './utils/cache';
