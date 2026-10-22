import {useCallback, useRef} from "react";
import type {ChatItem} from "./types";
import {useChatMessages, type UseChatSseStreamOptions} from "./use-chat-messages";

export type SubAgentInfo = {
  /** 工具调用 ID */
  toolCallId: string
  /** 工具名称 */
  toolName: string
  /** 对话 ID */
  conversationId: string
  /** 消息 ID */
  messageId: string
}

/**
 * 子智能体消息 Hook 的返回类型
 * @author 思追(shaco)
 */
export type UseSubAgentMessagesReturn = {
  /** 聊天记录列表 */
  chatList: ChatItem[]
  /** 是否正在加载中 */
  isLoading: boolean
  /** 加载子智能体消息（幂等：同一 conversationId:messageId 进行中不重复订阅） */
  load: (subAgentInfo: SubAgentInfo) => Promise<void>
  /** 中断当前 SSE 订阅，供组件卸载清理 */
  stop: () => void
}

/**
 * 定义子智能体消息 Hook
 * 在组件内部使用 useChatMessages 创建子智能体对话能力
 *
 * - load 幂等：基于 `conversationId:messageId` 标记进行中的订阅，重复调用直接返回
 * - stop 取消当前连接和等待中的重试，供上层在卸载或切换时清理
 */
export function useSubAgentMessages(options: UseChatSseStreamOptions): UseSubAgentMessagesReturn {
  const {chatList, runStream, isResponding, abortAllStreams, flushPendingUpdates, updateChatList} = useChatMessages(options)
  const loadingKeyRef = useRef<string | null>(null)

  const load = useCallback(async (subAgentInfo: SubAgentInfo) => {
    const key = `${subAgentInfo.conversationId}:${subAgentInfo.messageId}`
    if (loadingKeyRef.current === key && isResponding) {
      return
    }
    if (loadingKeyRef.current !== key) {
      // 子调用切换必须同时作废旧流及其终态补全，避免相同消息 ID 跨作用域回写。
      abortAllStreams()
      updateChatList([])
    }
    loadingKeyRef.current = key
    await runStream({
      conversationId: subAgentInfo.conversationId,
      messageId: subAgentInfo.messageId,
    })
  }, [abortAllStreams, updateChatList, runStream, isResponding])

  const stop = useCallback(() => {
    flushPendingUpdates()
    abortAllStreams()
    loadingKeyRef.current = null
  }, [abortAllStreams, flushPendingUpdates])

  return {
    chatList,
    isLoading: isResponding,
    load,
    stop,
  }
}
