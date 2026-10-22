import {AiChatSubmissionFromJSON} from "@lingya-ai/agents-sdk/browser";
import { describe, expect, it } from "vitest";

import { ConversationMessageStatus } from "./conversation-message";
import { resolveMessageDispatchAction } from "./message-dispatch-state";
import {AgentMessageDispatchDisposition} from "./schema";

describe("resolveMessageDispatchAction", () => {
  it("排队消息只轮询而不订阅流", () => {
    expect(resolveMessageDispatchAction(ConversationMessageStatus.QUEUED)).toBe("POLL");
  });

  it("只有执行中的消息订阅流", () => {
    expect(resolveMessageDispatchAction(ConversationMessageStatus.PENDING)).toBe("STREAM");
  });

  it("取消消息直接收口", () => {
    expect(resolveMessageDispatchAction(ConversationMessageStatus.CANCELLED)).toBe("SETTLE");
  });

  it.each([
    ConversationMessageStatus.COMPLETED,
    ConversationMessageStatus.ERROR,
    ConversationMessageStatus.INTERRUPTED,
  ])("Agent 终态 %s 加载可回放事件", (status) => {
    expect(resolveMessageDispatchAction(status)).toBe("LOAD_EVENTS");
  });

  it("依据 SDK 返回的调度状态处理提交响应", () => {
    const result = AiChatSubmissionFromJSON({
      disposition: "STARTED", status: "PENDING",
      conversationId: "conversation",
      messageId: "message",
    });

    expect(result.disposition).toBe(AgentMessageDispatchDisposition.STARTED);
    expect(result.status).toBe(ConversationMessageStatus.PENDING);
  });
});
