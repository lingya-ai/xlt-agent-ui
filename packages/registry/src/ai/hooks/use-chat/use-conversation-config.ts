import {useCallback} from "react"
import {useAiChatRequestSignal} from "../../agents/context";
import type {RequestOptions} from "@lingya-ai/agents-sdk/browser";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";



import type {ConversationConfig} from "@lingya-ai/agents-sdk/browser";
export type {ConversationConfig} from "@lingya-ai/agents-sdk/browser";

/** 请求指定会话配置，独立导出便于校验公共接口契约。 */
export function requestConversationConfig(
  httpClient: AgentsClient,
  conversationId: string,
  options: RequestOptions={},
): Promise<ConversationConfig> {
  return httpClient.configuration.getConversationConfig(conversationId, options)
}

/** 获取历史会话配置。 */
export function useConversationConfig({httpClient}: {httpClient: AgentsClient}) {
  const signal=useAiChatRequestSignal(httpClient)
  return useCallback(
    (conversationId: string) => requestConversationConfig(httpClient, conversationId, {signal}),
    [httpClient,signal],
  )
}
