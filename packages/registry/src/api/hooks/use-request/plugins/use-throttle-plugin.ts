'use client';

import {useEffect, useMemo, useRef} from 'react';
import type {Plugin} from '../types';

interface ThrottledFunc<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): ReturnType<T> | undefined;

  cancel(): void;
}

interface ThrottleSettings {
  leading?: boolean;
  trailing?: boolean;
}

/**
 * Simple throttle implementation
 */
function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
  options: ThrottleSettings = {}
): ThrottledFunc<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;
  let lastThis: unknown;
  let result: ReturnType<T>;
  let lastCallTime = 0;

  const {leading = true, trailing = true} = options;

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

  const trailingEdge = (time: number): void => {
    timeoutId = undefined;

    // Only invoke if we have trailing arguments and trailing is enabled
    if (trailing && lastArgs) {
      invokeFunc(time);
    }
    lastArgs = undefined;
    lastThis = undefined;
  };

  const timerExpired = (): void => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge(time);
    } else {
      timeoutId = startTimer(timerExpired, remainingWait(time));
    }
  };

  const throttled = function (this: unknown, ...args: Parameters<T>): ReturnType<T> | undefined {
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

      if (timeoutId === undefined) {
        timeoutId = startTimer(timerExpired, wait);
      }
    }

    return result;
  } as ThrottledFunc<T>;

  throttled.cancel = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    lastArgs = undefined;
    lastThis = undefined;
    lastCallTime = 0;
  };

  return throttled;
}

/**
 * Throttle plugin for useRequest
 * Throttles the execution of the request function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useThrottlePlugin: Plugin<any, unknown[]> = (
  fetchInstance,
  {throttleWait, throttleLeading, throttleTrailing}
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const throttledRef = useRef<ThrottledFunc<any>>(undefined);

  const options = useMemo(() => {
    const ret: ThrottleSettings = {};
    if (throttleLeading !== undefined) {
      ret.leading = throttleLeading;
    }
    if (throttleTrailing !== undefined) {
      ret.trailing = throttleTrailing;
    }
    return ret;
  }, [throttleLeading, throttleTrailing]);

  useEffect(() => {
    if (throttleWait) {
      const _originRunAsync = fetchInstance.runAsync.bind(fetchInstance);

      throttledRef.current = throttle(
        ((callback: () => void) => {
          callback();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
        throttleWait,
        options
      );

      const throttled = throttledRef.current;

      fetchInstance.runAsync = (...args) => {
        return new Promise((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (throttled as any)(() => {
            _originRunAsync(...args)
              .then(resolve)
              .catch(reject);
          });
        });
      };

      return () => {
        throttled.cancel();
        fetchInstance.runAsync = _originRunAsync;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [throttleWait, options]);

  if (!throttleWait) {
    return {};
  }

  return {
    onCancel: () => {
      throttledRef.current?.cancel();
    },
  };
};

export default useThrottlePlugin;
