import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import type { ChatItem } from "../hooks/use-chat/types";
import { resolveConversationExecutionType } from "../hooks/use-chat/conversation-execution-type";

export interface MessageQueueView {
  queuedMessages: ChatItem[];
  visibleMessages: ChatItem[];
}

/**
 * 将完整聊天状态拆分为输入区队列与正文消息。
 *
 * 完整列表仍由 useChat 持有；这里只生成展示视图，避免排队消息同时出现在输入区和正文。
 */
export function createMessageQueueView(
  chatList: readonly ChatItem[],
): MessageQueueView {
  const queuedMessages: ChatItem[] = [];
  const visibleMessages: ChatItem[] = [];

  for (const message of chatList) {
    if (message.status === ConversationMessageStatus.QUEUED &&
      resolveConversationExecutionType(message.user, message.executionType) !== "ASYNC_TASK_NOTIFICATION") {
      queuedMessages.push(message);
      continue;
    }

    if (message.status !== ConversationMessageStatus.CANCELLED) {
      visibleMessages.push(message);
    }
  }

  return { queuedMessages, visibleMessages };
}
