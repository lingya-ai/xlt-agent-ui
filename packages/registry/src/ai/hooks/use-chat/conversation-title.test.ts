import {ConversationTitleFromJSON} from "@lingya-ai/agents-sdk/browser";
import { describe, expect, it } from "vitest";

import {
  createLocalConversationTitle,
  isKnownConversationTitleState,
  isPendingConversationTitleState,
  isTerminalConversationTitleState,
} from "./conversation-title";

describe("conversation title", () => {
  it("识别生成中与终态", () => {
    expect(isPendingConversationTitleState("PENDING")).toBe(true);
    expect(isPendingConversationTitleState("GENERATING")).toBe(true);
    expect(isTerminalConversationTitleState("AUTO")).toBe(true);
    expect(isTerminalConversationTitleState("FALLBACK")).toBe(true);
    expect(isTerminalConversationTitleState("MANUAL")).toBe(true);
  });

  it("保留未知状态供前端安全降级", () => {
    const result = ConversationTitleFromJSON({
      conversationId: "conversation-1",
      title: "标题",
      titleState: "FUTURE_STATE",
    });

    expect(result.titleState).toBe("FUTURE_STATE");
    expect(isKnownConversationTitleState(result.titleState)).toBe(false);
  });

  it("使用首条消息前 30 个字符生成本地兜底标题", () => {
    expect(
      createLocalConversationTitle(`  ${"一".repeat(35)}  `, "未命名对话"),
    ).toBe("一".repeat(30));
    expect(createLocalConversationTitle("   ", "未命名对话")).toBe(
      "未命名对话",
    );
  });
});
