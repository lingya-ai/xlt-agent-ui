// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { usePlanModeConfigRefresh } from "./use-plan-mode-config-refresh";
import type { ChatItem } from "../hooks/use-chat/types";
import {
  AiChatEventTypeEnum,
  type AiChatEvent,
} from "../hooks/use-chat/schema";

afterEach(cleanup);
const completed = (id: string): ChatItem => ({
  id,
  loaded: true,
  loading: false,
  assistant: [{ type: AiChatEventTypeEnum.End } as AiChatEvent],
});

it("连续排队保持正在回复时仍逐轮刷新，历史加载不重复刷新", () => {
  const refresh = vi.fn();
  const { rerender } = renderHook(
    ({ chatList }) =>
      usePlanModeConfigRefresh({
        conversationId: "c1",
        chatList,
        isResponding: true,
        awaitingPlanApproval: false,
        refreshConversationConfig: refresh,
      }),
    { initialProps: { chatList: [] as ChatItem[] } },
  );
  rerender({ chatList: [completed("m1")] });
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender({ chatList: [completed("older"), completed("m1")] });
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender({ chatList: [completed("m1"), completed("m2")] });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it("审批结束与中断停止均刷新模式", () => {
  const refresh = vi.fn();
  const { rerender } = renderHook(
    ({ responding, approval }) =>
      usePlanModeConfigRefresh({
        conversationId: "c1",
        chatList: [],
        isResponding: responding,
        awaitingPlanApproval: approval,
        refreshConversationConfig: refresh,
      }),
    { initialProps: { responding: true, approval: true } },
  );
  rerender({ responding: true, approval: false });
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender({ responding: false, approval: false });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it("切换会话不把旧会话结束当成新会话事件", () => {
  const refresh = vi.fn();
  const { rerender } = renderHook(
    ({ cid, responding }) =>
      usePlanModeConfigRefresh({
        conversationId: cid,
        chatList: [completed(cid)],
        isResponding: responding,
        awaitingPlanApproval: false,
        refreshConversationConfig: refresh,
      }),
    { initialProps: { cid: "c1", responding: true } },
  );
  rerender({ cid: "c2", responding: false });
  expect(refresh).not.toHaveBeenCalled();
});
