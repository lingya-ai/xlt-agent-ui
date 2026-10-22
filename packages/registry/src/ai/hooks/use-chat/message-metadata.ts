import type {ConversationMessageOutput} from "./conversation-message";
import {isTerminalMessageStatus} from "./conversation-message-status";
import type {ChatItem} from "./types";

export type MessageStatistics = Pick<ChatItem, "processingSteps" | "totalToolCalls" | "executionTimeMillis">;

/** 只合并服务端有效统计，保留尚未返回的字段，不触碰用户内容或事件流。 */
export function pickMessageStatistics(message: MessageStatistics): MessageStatistics {
  const result: MessageStatistics = {};
  if (Number.isInteger(message.processingSteps) && (message.processingSteps ?? -1) >= 0) {
    result.processingSteps = message.processingSteps;
  }
  if (Number.isInteger(message.totalToolCalls) && (message.totalToolCalls ?? -1) >= 0) {
    result.totalToolCalls = message.totalToolCalls;
  }
  if (Number.isFinite(message.executionTimeMillis) && (message.executionTimeMillis ?? -1) >= 0) {
    result.executionTimeMillis = message.executionTimeMillis;
  }
  return result;
}

/** 仅判断服务端状态与统计字段是否合法，不推断统计事务成功，也不以可见事件否定合法零值。 */
export function hasSettledMessageStatistics(message: MessageStatistics & Pick<ConversationMessageOutput, "status">): boolean {
  const statistics = pickMessageStatistics(message);
  return isTerminalMessageStatus(message.status) && statistics.processingSteps !== undefined &&
    statistics.totalToolCalls !== undefined && statistics.executionTimeMillis !== undefined;
}
