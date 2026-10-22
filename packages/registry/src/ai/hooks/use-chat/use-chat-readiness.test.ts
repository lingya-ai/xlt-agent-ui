// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConversationMessageStatus } from "./conversation-message-status";
import {
  getReadyTerminalMessageIds,
  useChatReadiness,
} from "./use-chat-readiness";
import type { ChatItem } from "./types";

const ready: ChatItem = {
  id: "m1",
  loaded: true,
  loading: false,
  assistant: [],
  status: ConversationMessageStatus.COMPLETED,
};
afterEach(cleanup);
it("就绪必须区分终态、历史占位、排队、恢复和初始化，空结果可以就绪", () => {
  expect(
    getReadyTerminalMessageIds(
      [
        ready,
        { ...ready, id: "placeholder", loaded: false },
        { ...ready, id: "queued", status: ConversationMessageStatus.QUEUED },
        { ...ready, id: "pending", status: ConversationMessageStatus.PENDING },
        { ...ready, id: "rebuilding", streamRecoveryState: "rebuilding" },
        { ...ready, id: "error", status: ConversationMessageStatus.ERROR },
      ],
      false,
    ),
  ).toEqual(["m1", "error"]);
  expect(getReadyTerminalMessageIds([ready], true)).toEqual([]);
});
it("切换和卸载撤销旧实例就绪状态，回调变化不重复触发", () => {
  const callback = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ id }) =>
      useChatReadiness(id, [ready], false, (value) => callback(value)),
    { initialProps: { id: "a" } },
  );
  rerender({ id: "a" });
  expect(callback).toHaveBeenCalledTimes(1);
  rerender({ id: "b" });
  expect(callback).toHaveBeenNthCalledWith(2, {
    conversationId: "a",
    readyTerminalMessageIds: [],
  });
  unmount();
  expect(callback).toHaveBeenLastCalledWith({
    conversationId: "b",
    readyTerminalMessageIds: [],
  });
});
