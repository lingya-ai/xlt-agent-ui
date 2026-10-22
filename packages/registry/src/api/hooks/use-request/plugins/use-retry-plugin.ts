'use client';

import {useRef} from 'react';
import type {Plugin} from '../types';

/**
 * Retry plugin for useRequest
 * Automatically retries failed requests
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useRetryPlugin: Plugin<any, unknown[]> = (fetchInstance, {retryCount = 0, retryInterval = 0}) => {
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!retryCount) {
    return {};
  }

  return {
    onBefore: () => {
      // 清除之前的重试定时器，避免并发重试
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      retryCountRef.current = 0;
    },
    onError: () => {
      retryCountRef.current += 1;

      if (retryCountRef.current <= retryCount) {
        if (retryInterval) {
          timerRef.current = setTimeout(() => {
            fetchInstance.refresh();
          }, retryInterval);
        } else {
          fetchInstance.refresh();
        }
      }
    },
    onCancel: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
  };
};

export default useRetryPlugin;
