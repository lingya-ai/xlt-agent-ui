import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useRequest} from "../../../api/hooks/use-request/index";
import type {Result as UseRequestReturnType} from "../../../api/hooks/use-request/types";
import {useAiChatRequestSignal} from "../../agents/context";
import {useCallback, useEffect, useRef} from "react"
import {useChatClientCacheKey} from "./use-chat-client-cache-key";




/**
 * 获取文件预签名读取 URL
 *
 * 调用 agents controller 的 `GET /conversations/{conversationId}/files/{fileId}/preview` 接口。
 *
 * @param httpClient - 已配置好 basePath 的 HTTP 客户端
 * @param conversationId - 文件所属的会话 ID
 * @returns `(fileId: number) => Promise<{ url: string }>`
 */
export function useFilePreviewUrlCallback(
  httpClient: AgentsClient,
  conversationId: string,
): (fileId: number, options?: {cache?: RequestCache}) => Promise<{ url: string }> {
  const signal=useAiChatRequestSignal(httpClient)
  return useCallback(async (fileId: number) => {
    return httpClient.files.getConversationFilePreview(conversationId, fileId, {signal})
  }, [conversationId, httpClient, signal])
}

/**
 * 获取文件预签名读取 URL
 */
export function useFilePreviewUrlRequest(
  httpClient: AgentsClient,
  conversationId: string,
  fileId: number,
): UseRequestReturnType<{ url: string }, unknown[]> {
  const filePreviewUrlCallback = useFilePreviewUrlCallback(httpClient, conversationId);

  return useRequest(() => filePreviewUrlCallback(fileId), {
    cacheKey: useChatClientCacheKey(httpClient, 'file-preview', conversationId, fileId),
    staleTime: 5 * 60 * 1000,
    refreshDeps: [conversationId, fileId, httpClient],
  });
}


/**
 * 获取文件的 blob url
 */
export function useFileBlobUrlRequest(
  httpClient: AgentsClient,
  conversationId: string,
  fileId: number,
  options: {ready?: boolean} = {},
): UseRequestReturnType<string, unknown[]> {
  const filePreviewUrlCallback = useFilePreviewUrlCallback(httpClient, conversationId);

  const {runAsync: filePreviewUrlFetch} = useRequest(() => filePreviewUrlCallback(fileId), {
    cacheKey: useChatClientCacheKey(httpClient, 'file-preview', conversationId, fileId),
    staleTime: 5 * 60 * 1000,
    manual: true,
  });

  const objectUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    return () => {
      const objectUrl = objectUrlRef.current
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  return useRequest(async () => {
    const {url} = await filePreviewUrlFetch()
    const res = await fetch(url)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)

    const oldObjectUrl = objectUrlRef.current
    if (oldObjectUrl) URL.revokeObjectURL(oldObjectUrl)

    objectUrlRef.current = objectUrl
    return objectUrl
  }, {
    ready: options.ready,
    refreshDeps: [conversationId, fileId, httpClient],
  });
}
