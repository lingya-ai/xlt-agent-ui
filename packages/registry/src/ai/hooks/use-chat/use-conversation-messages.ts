import {useAiChatRequestSignal} from "../../agents/context";
import {useCallback} from "react";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";

import {type ConversationMessageList, type ConversationMessageListInput, conversationMessageListInputSchema} from "./conversation-message";

const pendingMessageRequests = new WeakMap<
  object,
  Map<string, Promise<ConversationMessageList>>
>();

export {ConversationMessageStatus, conversationMessageListInputSchema, conversationMessageStatusSchema, isTerminalMessageStatus, type ConversationMessageList, type ConversationMessageListInput, type ConversationMessageOutput} from "./conversation-message";


export type UseConversationMessagesOptions = {
  httpClient: AgentsClient
  /**
   * 获取消息列表的请求路径。未提供时使用常规会话接口。
   */
  getPath?: (conversationId: string) => string
}

/**
 * 获取对话消息列表
 * @param param0
 * @param param0.httpClient
 */
export function useConversationMessages(
  {
    httpClient,
  }: UseConversationMessagesOptions): (conversationId: string, input?: ConversationMessageListInput) => Promise<ConversationMessageList> {
  const signal=useAiChatRequestSignal(httpClient);
  return useCallback(async (conversationId: string, input?: ConversationMessageListInput) => {
    const validated = input ? conversationMessageListInputSchema.parse(input) : {}
    const requestMode = validated.current === null || validated.current === undefined
      ? "unpaged"
      : `page-${validated.current}`;
    const requestKey = `${conversationId}:${requestMode}:${validated.size ?? "default"}`;
    const clientRequests = pendingMessageRequests.get(signal??httpClient) ?? new Map();
    pendingMessageRequests.set(signal??httpClient, clientRequests);
    const pendingRequest = clientRequests.get(requestKey);
    if (pendingRequest) return pendingRequest;

    const request = httpClient.messages.listConversationMessages(conversationId, {...validated, current: validated.current ?? undefined, orderBy: ["createdTime"], orderDirection: "DESC",signal}).then((response) => ({
      ...response,
      // 服务端统一按 DESC 返回；反转后按时间正序展示，兼容分页与不分页查询。
      records: [...response.records].reverse(),
    }));
    clientRequests.set(requestKey, request);

    try {
      return await request;
    } finally {
      if (clientRequests.get(requestKey) === request) {
        clientRequests.delete(requestKey);
      }
    }
  }, [httpClient,signal])
}
