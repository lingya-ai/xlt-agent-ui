import { describe, expect, it } from "vitest";
import { matchesConversationView } from "./conversation-lifecycle";
import {
  ConversationQueryStatus,
  ConversationStatus,
  conversationStatusInputSchema,
} from "./use-conversation-operations";

describe("会话视图", () => {
  it("正常和归档视图互斥，ALL 保留两种状态", () => {
    expect(
      matchesConversationView(
        ConversationQueryStatus.ACTIVE,
        ConversationStatus.ACTIVE,
      ),
    ).toBe(true);
    expect(
      matchesConversationView(
        ConversationQueryStatus.ACTIVE,
        ConversationStatus.ARCHIVED,
      ),
    ).toBe(false);
    expect(
      matchesConversationView(
        ConversationQueryStatus.ARCHIVED,
        ConversationStatus.ACTIVE,
      ),
    ).toBe(false);
    expect(
      matchesConversationView(
        ConversationQueryStatus.ARCHIVED,
        ConversationStatus.ARCHIVED,
      ),
    ).toBe(true);
    for (const status of [
      ConversationStatus.ACTIVE,
      ConversationStatus.ARCHIVED,
    ])
      expect(matchesConversationView(ConversationQueryStatus.ALL, status)).toBe(
        true,
      );
    expect(
      matchesConversationView(
        ConversationQueryStatus.ALL,
        ConversationStatus.DELETED,
      ),
    ).toBe(false);
  });
  it("状态更新接口不能用于删除", () => {
    expect(
      conversationStatusInputSchema.safeParse({
        status: ConversationStatus.DELETED,
      }).success,
    ).toBe(false);
  });
});
