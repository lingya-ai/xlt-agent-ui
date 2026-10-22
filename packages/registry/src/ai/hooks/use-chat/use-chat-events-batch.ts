import {useCallback} from 'react';
import type {AgentsClient, AiChatEventsBatch} from '@lingya-ai/agents-sdk/browser';
import {useAiChatRequestSignal} from '../../agents/context';
export type {AiChatMessageEvent as ChatMessageEventOutput, AiChatEventsBatchSkipped as ChatEventsBatchSkippedOutput, AiChatEventsBatch as ChatEventsBatchResp} from '@lingya-ai/agents-sdk/browser';
export const BATCH_MAX_SIZE = 50;
export type UseChatEventsBatchOptions = {httpClient:AgentsClient};
/** SDK 批量历史事件查询；不对响应再作解析或补字段 */
export function useChatEventsBatch({httpClient}:UseChatEventsBatchOptions) {
 const providerSignal = useAiChatRequestSignal(httpClient);
 return useCallback((conversationId:string,messageIds:string[],signal?:AbortSignal):Promise<AiChatEventsBatch> => httpClient.events.getChatEventsBatch({conversationId,messageIds},{signal:signal??providerSignal}),[httpClient,providerSignal]);
}
