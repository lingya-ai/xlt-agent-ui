"use client";

import { useEffect, useRef } from "react";
import useMemoizedFn from "../../use-memoized-fn";
import type { Plugin } from "../types";

/** 请求完成后调度下一轮；停用、取消和卸载都必须清理可见性订阅。 */
const usePollingPlugin: Plugin<unknown, unknown[]> = (
  fetchInstance,
  { pollingInterval, pollingWhenHidden = true },
) => {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const active = useRef(false);
  const inFlight = useRef(false);
  const stop = useMemoizedFn(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  });
  const cleanup = useMemoizedFn(() => {
    stop();
    unsubscribe.current?.();
    unsubscribe.current = undefined;
  });
  const schedule = useMemoizedFn(() => {
    stop();
    if (!pollingInterval || !active.current || inFlight.current) return;
    if (
      !pollingWhenHidden &&
      typeof document !== "undefined" &&
      document.hidden
    )
      return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      fetchInstance.silentRefresh();
    }, pollingInterval);
  });
  const subscribe = useMemoizedFn(() => {
    if (
      !pollingInterval ||
      pollingWhenHidden ||
      unsubscribe.current ||
      typeof document === "undefined"
    )
      return;
    const onVisibility = () => {
      if (document.hidden) stop();
      else schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    unsubscribe.current = () =>
      document.removeEventListener("visibilitychange", onVisibility);
  });
  useEffect(() => {
    cleanup();
    if (pollingInterval && active.current) {
      subscribe();
      schedule();
    }
    return cleanup;
  }, [pollingInterval, pollingWhenHidden, cleanup, subscribe, schedule]);
  return {
    onBefore: () => {
      active.current = true;
      inFlight.current = true;
      stop();
    },
    onFinally: () => {
      inFlight.current = false;
      subscribe();
      schedule();
    },
    onCancel: () => {
      active.current = false;
      inFlight.current = false;
      cleanup();
    },
  };
};

export default usePollingPlugin;
