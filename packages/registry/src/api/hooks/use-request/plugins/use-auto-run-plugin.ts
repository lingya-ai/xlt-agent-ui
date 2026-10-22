'use client';

import {useEffect, useRef} from 'react';
import type {Plugin} from '../types';

/**
 * Auto run plugin for useRequest
 * Handles automatic execution on mount and dependency changes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useAutoRunPlugin: Plugin<any, unknown[]> = (
  fetchInstance,
  {manual, ready = true, defaultParams, refreshDeps = [], refreshDepsAction}
) => {
  const hasAutoRun = useRef(false);
  const hasTriggeredByRefetch = useRef(false);

  useEffect(() => {
    if (!manual && ready) {
      if (!hasAutoRun.current) {
        hasAutoRun.current = true;
        fetchInstance.run(...(defaultParams || []));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!manual && ready) {
      if (hasAutoRun.current) {
        if (!hasTriggeredByRefetch.current) {
          hasTriggeredByRefetch.current = true;
          return;
        }
        if (refreshDepsAction) {
          refreshDepsAction();
        } else {
          fetchInstance.refresh();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...refreshDeps]);

  return {};
};

export default useAutoRunPlugin;
