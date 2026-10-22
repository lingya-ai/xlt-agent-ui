'use client';

import {useEffect} from 'react';

/**
 * Run a callback on unmount only
 */
function useUnmount(fn: () => void): void {
  useEffect(() => {
    return fn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useUnmount;
