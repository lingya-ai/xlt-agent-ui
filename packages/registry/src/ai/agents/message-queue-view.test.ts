import { describe, expect, it } from "vitest";

import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import type { ChatItem } from "../hooks/use-chat/types";
import { createMessageQueueView } from "./message-queue-view";

function createChatItem(
  id: string,
  status: ConversationMessageStatus,
): ChatItem {
  return {
    id,
    loading: status === ConversationMessageStatus.PENDING,
    loaded: true,
    user: { text: id },
    assistant: [],
    status,
  };
}

describe("createMessageQueueView", () => {
  it.each([true, false])("异步排队回调留在正文并兼容旧字段：嵌套=%s", nested => {
    const notification = {
      ...createChatItem("notification", ConversationMessageStatus.QUEUED),
      ...(nested ? {user: {text: "", executionType: "ASYNC_TASK_NOTIFICATION"}} :
        {executionType: "ASYNC_TASK_NOTIFICATION"}),
    };
    const view = createMessageQueueView([
      createChatItem("queued-1", ConversationMessageStatus.QUEUED),
      notification,
      createChatItem("queued-2", ConversationMessageStatus.QUEUED),
    ]);
    expect(view.queuedMessages.map(item => item.id)).toEqual(["queued-1", "queued-2"]);
    expect(view.visibleMessages).toEqual([notification]);
  });
  it("保持 FIFO 顺序并只把 QUEUED 消息放入输入区队列", () => {
    const chatList = [
      createChatItem("completed", ConversationMessageStatus.COMPLETED),
      createChatItem("queued-1", ConversationMessageStatus.QUEUED),
      createChatItem("pending", ConversationMessageStatus.PENDING),
      createChatItem("queued-2", ConversationMessageStatus.QUEUED),
      createChatItem("cancelled", ConversationMessageStatus.CANCELLED),
    ];

    const view = createMessageQueueView(chatList);

    expect(view.queuedMessages.map((message) => message.id)).toEqual([
      "queued-1",
      "queued-2",
    ]);
    expect(view.visibleMessages.map((message) => message.id)).toEqual([
      "completed",
      "pending",
    ]);
  });

  it("消息提升为 PENDING 后从队列进入正文", () => {
    const queued = createChatItem("message", ConversationMessageStatus.QUEUED);
    expect(createMessageQueueView([queued]).queuedMessages).toHaveLength(1);

    const pending = { ...queued, status: ConversationMessageStatus.PENDING };
    const view = createMessageQueueView([pending]);

    expect(view.queuedMessages).toHaveLength(0);
    expect(view.visibleMessages.map((message) => message.id)).toEqual([
      "message",
    ]);
  });
});
