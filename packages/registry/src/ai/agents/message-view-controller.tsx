"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { useChatMessageViewPreference } from "../hooks/use-chat/chat-message-view-preference";
import {
  isMessageViewSwitchEnabled,
  type AgentsChatMessageViewMode,
  type AgentsChatMessageViewOptions,
} from "./message-disclosure-policy";
import {
  captureMessageScrollPosition,
  restoreMessageScrollPosition,
  type MessageScrollRestoreTarget,
} from "./message-scroll-anchor";

/** 管理展示模式；受控和显式初始值均不参与共享偏好。 */
export function useMessageViewController(
  options?: AgentsChatMessageViewOptions,
  defaultSwitchable = false,
) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const pendingScrollRestoreRef = useRef<
    MessageScrollRestoreTarget | undefined
  >(undefined);
  const usesPreference =
    options?.mode === undefined && options?.defaultMode === undefined;
  const preference = useChatMessageViewPreference(usesPreference);
  const [independentMode, setIndependentMode] =
    useState<AgentsChatMessageViewMode>(options?.defaultMode ?? "compact");
  const mode =
    options?.mode ?? (usesPreference ? preference.mode : independentMode);
  const canSwitch = isMessageViewSwitchEnabled(options, defaultSwitchable);

  useLayoutEffect(() => {
    const target = pendingScrollRestoreRef.current;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      restoreMessageScrollPosition(scrollRootRef.current, target);
      pendingScrollRestoreRef.current = undefined;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  const changeMode = (nextMode: AgentsChatMessageViewMode) => {
    if (nextMode === mode) return;
    pendingScrollRestoreRef.current = captureMessageScrollPosition(
      scrollRootRef.current,
    );
    if (options?.mode === undefined) {
      if (usesPreference) preference.setMode(nextMode);
      else setIndependentMode(nextMode);
    }
    // 非受控模式也通知调用方，不能将回调误当作受控标志。
    options?.onModeChange?.(nextMode);
  };

  return {
    mode,
    canSwitch,
    changeMode,
    scrollRootRef,
    captureScrollAnchor: () =>
      captureMessageScrollPosition(scrollRootRef.current),
    restoreScrollAnchor: (target: MessageScrollRestoreTarget) =>
      restoreMessageScrollPosition(scrollRootRef.current, target),
    preferenceError: preference.error,
    clearPreferenceError: preference.clearError,
  };
}
