import {hasReplayableMessageEvents, isExecutingMessageStatus, isQueuedMessageStatus} from "./conversation-message";

/** 前端收到消息状态后应采取的唯一调度动作。 */
export type MessageDispatchAction =
  | "POLL"
  | "STREAM"
  | "LOAD_EVENTS"
  | "SETTLE";

/**
 * 将后端消息状态转换为前端调度动作。
 *
 * 显式映射用于防止新增非终态时被误判为可以订阅 SSE。
 */
export function resolveMessageDispatchAction(
  status: string,
): MessageDispatchAction {
  if (isQueuedMessageStatus(status)) return "POLL";
  if (isExecutingMessageStatus(status)) return "STREAM";
  if (hasReplayableMessageEvents(status)) return "LOAD_EVENTS";
  return "SETTLE";
}
