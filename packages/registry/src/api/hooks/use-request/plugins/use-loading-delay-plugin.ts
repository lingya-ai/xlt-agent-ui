'use client';

import {useRef} from 'react';
import type {Plugin} from '../types';

/**
 * Loading delay plugin for useRequest
 * Delays the showing of loading state
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useLoadingDelayPlugin: Plugin<any, unknown[]> = (fetchInstance, {loadingDelay}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!loadingDelay) {
    return {};
  }

  return {
    onBefore: () => {
      timerRef.current = setTimeout(() => {
        fetchInstance.setState({
          loading: true,
        });
      }, loadingDelay);

      return {
        loading: false,
      };
    },
    onFinally: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    onCancel: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
  };
};

export default useLoadingDelayPlugin;
