import {useCallback} from 'react';
import type {AgentsClient, ReturnedReference} from '@lingya-ai/agents-sdk/browser';
import {useAiChatRequestSignal} from '../../agents/context';
import type {CitationContextType} from './citation-context';
/** 直接读取 SDK 引用元数据 */
export function useCitationMetadata(httpClient:AgentsClient):CitationContextType['fetchMetadata'] {
 const signal=useAiChatRequestSignal(httpClient);
 return useCallback(async(references:ReturnedReference[]) => (await httpClient.knowledge.getCitationMetadataBatch(references,{signal})).records,[httpClient,signal]);
}
