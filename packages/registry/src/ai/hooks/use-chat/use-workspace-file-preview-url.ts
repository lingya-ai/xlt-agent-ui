import {useCallback} from "react";
import type {AgentsClient,PreSignedReadUrl,RequestOptions} from "@lingya-ai/agents-sdk/browser";
import {useRequest} from "../../../api/hooks/use-request/index";
import {useAiChatRequestSignal} from "../../agents/context";
import {useChatClientCacheKey} from "./use-chat-client-cache-key";
export type UseWorkspaceFilePreviewUrlOptions={httpClient:AgentsClient};
/** 直接调用 SDK 获取当前工作区路径的预览地址。 */
export function useWorkspaceFilePreviewUrlCallback({httpClient}:UseWorkspaceFilePreviewUrlOptions) {
 const signal=useAiChatRequestSignal(httpClient);
 return useCallback((conversationId:string,relativePath:string,options:RequestOptions={}):Promise<PreSignedReadUrl> =>
 httpClient.workspace.getWorkspaceFilePreview(conversationId,{path:relativePath,...options,signal:options.signal??signal}),[httpClient,signal]);
}
export function useWorkspaceFilePreviewUrlRequest(options:UseWorkspaceFilePreviewUrlOptions,conversationId:string|undefined,relativePath:string|undefined) {
 const fetchUrl=useWorkspaceFilePreviewUrlCallback(options);
 return useRequest(()=>fetchUrl(conversationId!,relativePath!),{
 cacheKey:useChatClientCacheKey(options.httpClient,'workspace-file-preview',conversationId??null,relativePath??null),
 staleTime:5*60*1000,ready:Boolean(conversationId&&relativePath),refreshDeps:[conversationId,relativePath,options.httpClient]});
}
