import {useAiChatRequestSignal} from "../../agents/context";
import {useCallback} from "react";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";

import {type ChatEventsResp} from "./conversation-message";

export {type ChatEventsResp} from "./conversation-message";

export type UseChatEventsOptions = {
  httpClient: AgentsClient
}

/**
 * 获取已完结对话消息的事件列表
 */
export function useChatEvents(
  {
    httpClient
  }: UseChatEventsOptions): (conversationId: string, messageId: string) => Promise<ChatEventsResp> {
  const signal=useAiChatRequestSignal(httpClient);
  return useCallback((conversationId: string, messageId: string) => {
    return httpClient.events.getChatEvents({conversationId, messageId,signal})
  }, [httpClient,signal])
}
