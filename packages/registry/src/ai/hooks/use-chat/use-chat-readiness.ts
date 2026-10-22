"use client";

import { useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { isTerminalMessageStatus } from "./conversation-message-status";
import type { ChatItem } from "./types";

export interface AiChatReadiness {
  conversationId: string | undefined;
  readyTerminalMessageIds: readonly string[];
}

/** 只报告内容加载成功且不处于恢复阶段的终态消息，空结果同样可以就绪。 */
export function getReadyTerminalMessageIds(
  items: readonly ChatItem[],
  initializing: boolean,
): string[] {
  if (initializing) return [];
  return items
    .filter(
      (item) =>
        item.loaded &&
        !item.loading &&
        !item.streamRecoveryState &&
        item.status !== undefined &&
        isTerminalMessageStatus(item.status),
    )
    .map((item) => item.id);
}

/** 在提交渲染后报告就绪集合；离开当前实例时撤销旧集合。 */
export function useChatReadiness(
  conversationId: string | undefined,
  items: readonly ChatItem[],
  initializing: boolean,
  onChange?: (readiness: AiChatReadiness) => void,
) {
  const idsKey = JSON.stringify(
    getReadyTerminalMessageIds(items, initializing),
  );
  const notify = useMemoizedFn((value: AiChatReadiness) => onChange?.(value));
  useEffect(() => {
    notify({
      conversationId,
      readyTerminalMessageIds: JSON.parse(idsKey) as string[],
    });
    return () => notify({ conversationId, readyTerminalMessageIds: [] });
  }, [conversationId, idsKey, notify]);
}
