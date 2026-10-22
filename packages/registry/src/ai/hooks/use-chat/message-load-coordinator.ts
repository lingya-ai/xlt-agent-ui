/**
 * 消息历史加载与实时流之间的所有权协调器。
 *
 * 同一 messageId 任一时刻只能由历史请求或 SSE 流持有，避免异步历史响应覆盖实时增量。
 */
export class MessageLoadCoordinator {
  private readonly historyLoadingMessageIds = new Set<string>()
  private readonly historyLoadedMessageIds = new Set<string>()
  private readonly streamingMessageIds = new Set<string>()

  /** 尝试取得历史加载所有权。 */
  tryStartHistory(messageId: string): boolean {
    if (this.streamingMessageIds.has(messageId) ||
      this.historyLoadingMessageIds.has(messageId) ||
      this.historyLoadedMessageIds.has(messageId)) {
      return false
    }
    this.historyLoadingMessageIds.add(messageId)
    return true
  }

  /** 释放历史加载所有权。 */
  finishHistory(messageId: string): void {
    this.historyLoadingMessageIds.delete(messageId)
  }

  /** 标记完整历史已经合并。 */
  markHistoryLoaded(messageId: string): void {
    this.historyLoadingMessageIds.delete(messageId)
    this.historyLoadedMessageIds.add(messageId)
  }

  /** 将消息所有权切换到 SSE；返回 false 表示已有实时流持有。 */
  startStreaming(messageId: string): boolean {
    this.historyLoadingMessageIds.delete(messageId)
    if (this.streamingMessageIds.has(messageId)) return false
    this.streamingMessageIds.add(messageId)
    return true
  }

  /** 释放 SSE 所有权。 */
  finishStreaming(messageId: string): void {
    this.streamingMessageIds.delete(messageId)
  }

  /** 判断消息当前是否由 SSE 持有。 */
  isStreaming(messageId: string): boolean {
    return this.streamingMessageIds.has(messageId)
  }

  /** 会话切换时清空全部所有权。 */
  reset(): void {
    this.historyLoadingMessageIds.clear()
    this.historyLoadedMessageIds.clear()
    this.streamingMessageIds.clear()
  }
}
