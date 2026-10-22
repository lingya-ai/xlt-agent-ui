'use client';

import {useRef} from 'react';

/**
 * Like useMemo, but won't regenerate if deps are the same reference
 */
function useCreation<T>(factory: () => T, deps: unknown[]): T {
  const {current} = useRef<{
    deps: unknown[];
    obj: T | undefined;
    initialized: boolean;
  }>({
    deps: deps,
    obj: undefined,
    initialized: false,
  });

  if (!current.initialized || !depsAreSame(current.deps, deps)) {
    current.obj = factory();
    current.deps = deps;
    current.initialized = true;
  }

  return current.obj as T;
}

function depsAreSame(oldDeps: unknown[], deps: unknown[]): boolean {
  if (oldDeps === deps) return true;
  for (const i in oldDeps) {
    if (oldDeps[i] !== deps[i]) return false;
  }
  return true;
}

export default useCreation;
