'use client';

import {useEffect, useMemo, useRef} from 'react';
import type {Plugin} from '../types';

interface DebouncedFunc<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T> | undefined;

  cancel(): void;

  flush(): ReturnType<T> | undefined;
}

interface DebounceSettings {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

/**
 * Simple debounce implementation (without lodash dependency)
 */
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  options: DebounceSettings = {}
): DebouncedFunc<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;
  let lastThis: unknown;
  let result: ReturnType<T>;
  let lastCallTime = 0;
  let maxWaitTimeoutId: ReturnType<typeof setTimeout> | undefined;

  const {leading = false, trailing = true, maxWait} = options;

  const invokeFunc = (time: number): void => {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = undefined;
    lastThis = undefined;
    lastCallTime = time;

    result = func.apply(thisArg as ThisParameterType<T>, args as Parameters<T>) as ReturnType<T>;
  };

  const startTimer = (pendingFunc: () => void, waitTime: number): ReturnType<typeof setTimeout> => {
    return setTimeout(pendingFunc, waitTime);
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - lastCallTime;
    return lastCallTime === 0 || timeSinceLastCall >= wait;
  };

  const remainingWait = (time: number): number => {
    const timeSinceLastCall = time - lastCallTime;
    return wait - timeSinceLastCall;
  };

  const clearMaxWaitTimer = (): void => {
    if (maxWaitTimeoutId !== undefined) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = undefined;
    }
  };

  const timerExpired = (): void => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      timeoutId = undefined;
      clearMaxWaitTimer();

      if (trailing && lastArgs) {
        invokeFunc(time);
      }
      lastArgs = undefined;
      return;
    }

    // Restart the timer
    timeoutId = startTimer(timerExpired, remainingWait(time));
  };

  const debounced = function (this: unknown, ...args: Parameters<T>): ReturnType<T> | undefined {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;

    if (isInvoking) {
      if (timeoutId === undefined) {
        if (leading) {
          invokeFunc(time);
        } else {
          // Reset lastCallTime for trailing edge
          lastCallTime = time;
        }
      }

      if (maxWait) {
        // Handle max wait
        if (maxWaitTimeoutId !== undefined) {
          clearTimeout(maxWaitTimeoutId);
        }
        maxWaitTimeoutId = startTimer(() => {
          maxWaitTimeoutId = undefined;
          if (lastArgs) {
            invokeFunc(Date.now());
          }
        }, maxWait);
      }
    }

    if (timeoutId === undefined) {
      timeoutId = startTimer(timerExpired, wait);
    }

    return result;
  } as DebouncedFunc<T>;

  debounced.cancel = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    clearMaxWaitTimer();
    lastArgs = undefined;
    lastThis = undefined;
    lastCallTime = 0;
  };

  debounced.flush = (): ReturnType<T> | undefined => {
    if (timeoutId === undefined) {
      return result;
    }

    clearTimeout(timeoutId);
    timeoutId = undefined;
    clearMaxWaitTimer();

    const time = Date.now();
    if (lastArgs) {
      invokeFunc(time);
    }
    return result;
  };

  return debounced;
}

/**
 * Debounce plugin for useRequest
 * Delays the execution of the request function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useDebouncePlugin: Plugin<any, unknown[]> = (
  fetchInstance,
  {debounceWait, debounceLeading, debounceTrailing, debounceMaxWait}
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debouncedRef = useRef<DebouncedFunc<any>>(undefined);

  const options = useMemo(() => {
    const ret: DebounceSettings = {};
    if (debounceLeading !== undefined) {
      ret.leading = debounceLeading;
    }
    if (debounceTrailing !== undefined) {
      ret.trailing = debounceTrailing;
    }
    if (debounceMaxWait !== undefined) {
      ret.maxWait = debounceMaxWait;
    }
    return ret;
  }, [debounceLeading, debounceTrailing, debounceMaxWait]);

  useEffect(() => {
    if (debounceWait) {
      const _originRunAsync = fetchInstance.runAsync.bind(fetchInstance);

      debouncedRef.current = debounce(
        ((callback: () => void) => {
          callback();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
        debounceWait,
        options
      );

      // debounce runAsync should be promise
      fetchInstance.runAsync = (...args) => {
        return new Promise((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (debouncedRef.current as any)?.(() => {
            _originRunAsync(...args)
              .then(resolve)
              .catch(reject);
          });
        });
      };

      return () => {
        debouncedRef.current?.cancel();
        fetchInstance.runAsync = _originRunAsync;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceWait, options]);

  if (!debounceWait) {
    return {};
  }

  return {
    onCancel: () => {
      debouncedRef.current?.cancel();
    },
  };
};

export default useDebouncePlugin;
