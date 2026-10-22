"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChatItem } from "../hooks/use-chat/types";
import { AiChatEventTypeEnum } from "../hooks/use-chat/schema";

/** 每轮回复与审批结束后同步已生效模式，连续队列不能依赖整体执行状态的下降沿。 */
export function usePlanModeConfigRefresh({
  conversationId,
  chatList,
  isResponding,
  awaitingPlanApproval,
  refreshConversationConfig,
}: {
  conversationId?: string;
  chatList: readonly ChatItem[];
  isResponding: boolean;
  awaitingPlanApproval: boolean;
  refreshConversationConfig: () => void;
}) {
  const terminalMessageId = useMemo(
    () =>
      [...chatList]
        .reverse()
        .find((item) =>
          item.assistant?.some(
            (event) => event.type === AiChatEventTypeEnum.End,
          ),
        )?.id,
    [chatList],
  );
  const previous = useRef({
    conversationId,
    terminalMessageId,
    isResponding,
    awaitingPlanApproval,
  });
  useEffect(() => {
    const old = previous.current;
    previous.current = {
      conversationId,
      terminalMessageId,
      isResponding,
      awaitingPlanApproval,
    };
    if (
      old.conversationId === conversationId &&
      ((terminalMessageId && terminalMessageId !== old.terminalMessageId) ||
        (old.isResponding && !isResponding) ||
        (old.awaitingPlanApproval && !awaitingPlanApproval))
    )
      refreshConversationConfig();
  }, [
    awaitingPlanApproval,
    conversationId,
    isResponding,
    refreshConversationConfig,
    terminalMessageId,
  ]);
}
