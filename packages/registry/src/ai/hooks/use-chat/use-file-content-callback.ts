import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useRequest} from "../../../api/hooks/use-request/index";
import type {Result as UseRequestReturnType} from "../../../api/hooks/use-request/types";
import {useAiChatRequestSignal} from "../../agents/context";
import {useCallback} from "react"
import {useChatClientCacheKey} from "./use-chat-client-cache-key";




/**
 * 通过文件 ID 获取文件文本内容
 *
 * 先通过 `GET /conversations/{conversationId}/files/{fileId}/preview` 获取预签名 URL，再 fetch 内容。
 *
 * @param httpClient - 已配置好 basePath 的 HTTP 客户端
 * @param conversationId - 文件所属的会话 ID，不能为空
 * @returns `(fileId: number) => Promise<string>`
 */
export function useFileContentCallback(
  httpClient: AgentsClient,
  conversationId: string,
): (fileId: number) => Promise<string> {
  const signal=useAiChatRequestSignal(httpClient)
  return useCallback(async (fileId: number): Promise<string> => {
    const {url} = await httpClient.files.getConversationFilePreview(conversationId, fileId, {signal})
    const response = await fetch(url,{signal})
    if (!response.ok) throw new Error("获取文件内容失败")
    return response.text()
  }, [conversationId, httpClient, signal])
}

/**
 * 通过文件 ID 获取文件文本内容
 */
export function useFileContentRequest(
  httpClient: AgentsClient,
  conversationId: string,
  fileId: number,
): UseRequestReturnType<string, unknown[]> {
  const fileContentCallback = useFileContentCallback(httpClient, conversationId)

  return useRequest(() => fileContentCallback(fileId), {
    cacheKey: useChatClientCacheKey(httpClient, 'file-content', conversationId, fileId),
    staleTime: 5000 * 60 * 1000,
    refreshDeps: [conversationId, fileId, httpClient],
  });
}

/**
 * 通过计划审批中间态文件 ID 获取静态计划文本内容。
 *
 * 快照与会话消息绑定，避免读取提交后仍可被修改的原计划文件。
 */
export function usePlanIntermediateFileContentCallback(
  httpClient: AgentsClient,
  conversationId: string,
  messageId: string,
): (fileId: number) => Promise<string> {
  const signal=useAiChatRequestSignal(httpClient)
  return useCallback(async (fileId: number): Promise<string> => {
    const {url} = await httpClient.files.getPlanIntermediateFilePreview(conversationId, messageId, fileId, {signal})
    const response = await fetch(url,{signal})
    if (!response.ok) throw new Error("获取计划内容失败")
    return response.text()
  }, [conversationId, httpClient, messageId,signal])
}

/** 读取指定会话消息的计划审批中间态文件内容。 */
export function usePlanIntermediateFileContentRequest(
  httpClient: AgentsClient,
  conversationId: string,
  messageId: string,
  fileId: number,
): UseRequestReturnType<string, unknown[]> {
  const fileContentCallback = usePlanIntermediateFileContentCallback(httpClient, conversationId, messageId)

  return useRequest(() => fileContentCallback(fileId), {
    cacheKey: useChatClientCacheKey(httpClient, 'plan-intermediate-file-content', conversationId, messageId, fileId),
    staleTime: 5000 * 60 * 1000,
    refreshDeps: [conversationId, messageId, fileId, httpClient],
  });
}
