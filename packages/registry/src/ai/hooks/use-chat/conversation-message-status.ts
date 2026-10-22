import {z} from "zod";

/** 对话消息状态。 */
export enum ConversationMessageStatus {
  /** 等待同一会话中的前序消息完成。 */
  QUEUED = "QUEUED",
  /** 正在执行。 */
  PENDING = "PENDING",
  /** 已完成。 */
  COMPLETED = "COMPLETED",
  /** 异常。 */
  ERROR = "ERROR",
  /** 已中断。 */
  INTERRUPTED = "INTERRUPTED",
  /** 开始执行前已取消。 */
  CANCELLED = "CANCELLED",
}

export const conversationMessageStatusSchema = z.nativeEnum(ConversationMessageStatus);

/** 判断消息是否已经进入终态。 */
export function isTerminalMessageStatus(status: string): boolean {
  return (
    status === ConversationMessageStatus.COMPLETED ||
    status === ConversationMessageStatus.ERROR ||
    status === ConversationMessageStatus.INTERRUPTED ||
    status === ConversationMessageStatus.CANCELLED
  );
}

/** 判断消息是否正在执行，只有该状态允许订阅 SSE。 */
export function isExecutingMessageStatus(status: string): boolean {
  return status === ConversationMessageStatus.PENDING;
}

/** 判断消息是否仍在后端等待队列中。 */
export function isQueuedMessageStatus(status: string): boolean {
  return status === ConversationMessageStatus.QUEUED;
}

/** 判断终态消息是否可能存在可回放的 Agent 事件。 */
export function hasReplayableMessageEvents(status: string): boolean {
  return (
    status === ConversationMessageStatus.COMPLETED ||
    status === ConversationMessageStatus.ERROR ||
    status === ConversationMessageStatus.INTERRUPTED
  );
}

/** 判断当前状态是否允许建立实时消息流。 */
export const isStreamableMessageStatus = isExecutingMessageStatus;
