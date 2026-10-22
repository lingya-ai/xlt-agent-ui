'use client';

import {useEffect, useRef} from 'react';
import type {Plugin} from '../types';

/**
 * Refresh on window focus plugin for useRequest
 * Re-executes the request when the window regains focus
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useRefreshOnWindowFocusPlugin: Plugin<any, unknown[]> = (
  fetchInstance,
  {refreshOnWindowFocus = false, focusTimespan = 5000}
) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const lastExecuteTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!refreshOnWindowFocus) {
      return;
    }

    // SSR 兼容性检查
    if (typeof window === 'undefined') {
      return;
    }

    const handleFocus = (): void => {
      const now = Date.now();

      // Check if enough time has passed since last execution
      if (now - lastExecuteTimeRef.current < focusTimespan) {
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        fetchInstance.silentRefresh();
      }, 100);
    };

    window.addEventListener('focus', handleFocus);

    unsubscribeRef.current = () => {
      window.removeEventListener('focus', handleFocus);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };

    return () => {
      unsubscribeRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshOnWindowFocus, focusTimespan]);

  if (!refreshOnWindowFocus) {
    return {};
  }

  return {
    onSuccess: () => {
      lastExecuteTimeRef.current = Date.now();
    },
    onError: () => {
      // 失败时也更新时间戳，避免连续失败请求
      lastExecuteTimeRef.current = Date.now();
    },
    onCancel: () => {
      unsubscribeRef.current?.();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
  };
};

export default useRefreshOnWindowFocusPlugin;
