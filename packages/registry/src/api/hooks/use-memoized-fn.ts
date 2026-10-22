'use client';

import {useCallback, useRef} from 'react';

/**
 * Like useCallback, but the function reference never changes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useMemoizedFn<T extends (...args: any[]) => any>(fn: T): T {
  const fnRef = useRef<T>(fn);

  fnRef.current = fn;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCallback((...args: any[]) => {
    return fnRef.current(...args);
  }, []) as T;
}

export default useMemoizedFn;
