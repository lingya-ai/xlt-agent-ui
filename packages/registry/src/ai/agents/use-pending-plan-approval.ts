"use client";

import { useCallback, useEffect } from "react";
import {useAiChatRequestSignal} from "./context";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import { useApiRequest } from "../../api/hooks/use-api-request";
import type { ChatItem } from "../hooks/use-chat/types";
import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import { buildToolSegmentProjection } from "./tool-presentation-projection";


/** 仅检查活跃消息中的审批，不让历史终态消息影响输入框。 */
export function findPendingPlanApprovalMessage(
  chatList: readonly ChatItem[],
): string | undefined {
  return [...chatList]
    .reverse()
    .find(
      (item) =>
        (item.loading || item.status === ConversationMessageStatus.PENDING) &&
        buildToolSegmentProjection(item.assistant).hasPendingPlanApproval,
    )?.id;
}

/** 用服务端等待状态复核工具投影，重连后的旧 AwaitingApproval 事件不能长期隐藏输入框。 */
export function usePendingPlanApproval({
  httpClient,
  conversationId,
  chatList,
  enabled,
}: {
  httpClient: AgentsClient;
  conversationId?: string;
  chatList: readonly ChatItem[];
  enabled: boolean;
}) {
  const signal=useAiChatRequestSignal(httpClient);
  const messageId = enabled
    ? findPendingPlanApprovalMessage(chatList)
    : undefined;
  const requestStatus = useCallback(
    async (cid: string, mid: string) => ({
      conversationId: cid,
      messageId: mid,
      ...(await httpClient.interactions.getMessagePlanStatus(cid, mid, {signal})),
    }),
    [httpClient,signal],
  );
  const { data, run, cancel } = useApiRequest(requestStatus, {
    manual: true,
    pollingInterval: 1000,
    disableErrorNotification: true,
  });
  useEffect(() => {
    if (conversationId && messageId) run(conversationId, messageId);
    else cancel();
    return cancel;
  }, [cancel, conversationId, messageId, run]);

  return Boolean(
    messageId &&
      data?.conversationId === conversationId &&
      data?.messageId === messageId &&
      data?.pending,
  );
}
