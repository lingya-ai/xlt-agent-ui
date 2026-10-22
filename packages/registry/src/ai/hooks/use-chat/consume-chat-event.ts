import { ConversationMessageStatus } from "./conversation-message";
import { resolveConversationExecutionType } from "./conversation-execution-type";
import { type AiChatEvent, AiChatEventTypeEnum } from "./schema";
import type { ChatItem } from "./types";

/**
 * 将单条聊天事件归并到消息项中。
 *
 * 该函数不依赖 React，可同时用于实时 SSE 消费和只读历史回放。
 */
export function consumeChatEvent(
  chatItem: ChatItem,
  data: AiChatEvent,
): ChatItem {
  // 未知事件由 SDK 保留原文，进入 UI 历史但不参与已知事件的状态归并
  if ('rawJson' in data) return {...chatItem, assistant: [...chatItem.assistant, data]};
  let nextChatItem: ChatItem;

  switch (data.type) {
    case AiChatEventTypeEnum.UserQuery: {
      const executionType = resolveConversationExecutionType(chatItem.user, chatItem.executionType);
      // 内部后续轮只更新来源标识，不将执行指令作为用户输入展示。
      if (executionType === "ASYNC_TASK_NOTIFICATION" || executionType === "GOAL_CONTINUATION") {
        return {
          ...chatItem,
          executionType,
          user: { ...chatItem.user, text: chatItem.user?.text ?? "", executionType },
        };
      }
      nextChatItem = {
        ...chatItem,
        executionType,
        user: {
          ...chatItem.user,
          executionType,
          text: data.query,
          attachments: data.attachments,
        },
        assistant: [...chatItem.assistant, { ...data }],
      };
      break;
    }
    case AiChatEventTypeEnum.Message: {
      const lastMessage = chatItem.assistant[chatItem.assistant.length - 1];
      const assistant =
        lastMessage && !("rawJson" in lastMessage) && lastMessage.type === AiChatEventTypeEnum.Message
          ? [
              ...chatItem.assistant.slice(0, -1),
              { ...lastMessage, message: lastMessage.message + data.message },
            ]
          : [...chatItem.assistant, { ...data }];
      nextChatItem = { ...chatItem, assistant };
      break;
    }
    case AiChatEventTypeEnum.Think: {
      const lastMessage = chatItem.assistant[chatItem.assistant.length - 1];
      const assistant =
        lastMessage && !("rawJson" in lastMessage) && lastMessage.type === AiChatEventTypeEnum.Think
          ? [
              ...chatItem.assistant.slice(0, -1),
              { ...lastMessage, message: lastMessage.message + data.message },
            ]
          : [...chatItem.assistant, { ...data }];
      nextChatItem = { ...chatItem, assistant };
      break;
    }
    default:
      nextChatItem = {
        ...chatItem,
        assistant: [...chatItem.assistant, { ...data }],
      };
      break;
  }

  if (data.type !== AiChatEventTypeEnum.End) {
    return nextChatItem;
  }

  return {
    ...nextChatItem,
    loading: false,
    status: ConversationMessageStatus.COMPLETED,
  };
}
