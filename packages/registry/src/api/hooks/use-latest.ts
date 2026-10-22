'use client';

import {useRef} from 'react';

/**
 * Returns the latest value, similar to useRef but always returns the current value
 */
function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);

  ref.current = value;

  return ref;
}

export default useLatest;
