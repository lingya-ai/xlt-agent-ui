import type {ChatItem} from "./types";
import {type AiChatEvent, AiChatEventTypeEnum} from "./schema";
import {type ConsumeEventCallback} from "./use-consume-event";

/** 流式文本默认每 32ms 最多提交一次 React 状态。 */
const DEFAULT_RENDER_BATCH_INTERVAL_MS = 32

/** 单条 SSE 流的渲染批处理器。 */
export type ChatStreamRenderBatcher = {
  /** 消费事件；Message/Think 延迟批量提交，其他事件立即提交。 */
  consume: (event: AiChatEvent) => void
  /** 立即提交尚未渲染的 Message/Think 增量。 */
  flush: () => void
  /** 更新当前聊天项并立即提交，用于关闭和错误状态收口。 */
  updateAndFlush: (updater: (current: ChatItem) => ChatItem) => void
  /** 取消定时任务并停止继续消费。调用前应按需执行 flush。 */
  dispose: () => void
}

type CreateChatStreamRenderBatcherOptions = {
  initialChatItem: ChatItem
  consumeEvent: ConsumeEventCallback
  commit: (chatItem: ChatItem) => void
  intervalMs?: number
}

/** 判断是否为允许延迟渲染的纯文本增量事件。 */
function isBatchableIncrementEvent(event: AiChatEvent): boolean {
  return event.type === AiChatEventTypeEnum.Message || event.type === AiChatEventTypeEnum.Think
}

/**
 * 为单条 SSE 流创建独立的渲染批处理器。
 *
 * 当前聊天项始终通过不可变更新累积；批处理仅延迟 React 状态提交，不延迟事件消费。
 * 遇到 Start、End、Error、ToolExecution 等结构化事件时，会取消等待并立即提交包含此前文本增量的完整状态。
 */
export function createChatStreamRenderBatcher(
  {
    initialChatItem,
    consumeEvent,
    commit,
    intervalMs = DEFAULT_RENDER_BATCH_INTERVAL_MS,
  }: CreateChatStreamRenderBatcherOptions
): ChatStreamRenderBatcher {
  let currentChatItem = initialChatItem
  let timer: ReturnType<typeof setTimeout> | null = null
  let hasPendingIncrement = false
  let disposed = false

  const clearScheduledFlush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const commitPendingIncrement = () => {
    if (disposed || !hasPendingIncrement) {
      return
    }
    hasPendingIncrement = false
    commit(currentChatItem)
  }

  const flush = () => {
    clearScheduledFlush()
    commitPendingIncrement()
  }

  const scheduleFlush = () => {
    if (timer !== null) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      commitPendingIncrement()
    }, intervalMs)
  }

  return {
    consume: (event) => {
      if (disposed) {
        return
      }

      currentChatItem = consumeEvent(currentChatItem, event)

      if (isBatchableIncrementEvent(event)) {
        hasPendingIncrement = true
        scheduleFlush()
        return
      }

      // 结构化事件必须立即可见，同时一并带上此前尚未提交的文本增量。
      clearScheduledFlush()
      hasPendingIncrement = false
      commit(currentChatItem)
    },
    flush,
    updateAndFlush: (updater) => {
      if (disposed) {
        return
      }
      clearScheduledFlush()
      const previousChatItem = currentChatItem
      const hadPendingIncrement = hasPendingIncrement
      currentChatItem = updater(currentChatItem)
      hasPendingIncrement = false
      if (hadPendingIncrement || currentChatItem !== previousChatItem) {
        commit(currentChatItem)
      }
    },
    dispose: () => {
      clearScheduledFlush()
      hasPendingIncrement = false
      disposed = true
    },
  }
}
