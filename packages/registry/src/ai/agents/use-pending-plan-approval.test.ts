import {AiChatToolExecutionBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {
  findPendingPlanApprovalMessage,
  usePendingPlanApproval,
} from "./use-pending-plan-approval";
import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import {AiChatEventTypeEnum, TOOL_EXTENSION_CATEGORY, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import type { ChatItem } from "../hooks/use-chat/types";

const awaiting = AiChatToolExecutionBriefEventFromJSON({
  type: AiChatEventTypeEnum.ToolExecution,
  toolId: "approval",
  toolName: "submit_plan",
  status: ToolCallStatusEnum.AwaitingApproval,
  extension: {
    category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
    content: {
      previewFileId: 42,
      serverNow: "2026-10-08T00:00:00Z",
      approvalTimeoutAt: "2026-10-08T00:30:00Z",
    },
  },
});
const message: ChatItem = {
  id: "m1",
  loaded: true,
  loading: true,
  assistant: [awaiting],
};

it("重连向服务端复核旧审批，已过期不隐藏输入", async () => {
  const get = vi.fn().mockResolvedValue({ pending: false });
  const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
  vi.spyOn(httpClient.interactions,'getMessagePlanStatus').mockImplementation(get);
  const { result, unmount } = renderHook(() =>
    usePendingPlanApproval({
      httpClient,
      conversationId: "c1",
      chatList: [message],
      enabled: true,
    }),
  );
  await waitFor(() => expect(get).toHaveBeenCalled());
  expect(get.mock.calls[0]?.slice(0,2)).toEqual(["c1","m1"]);
  expect(result.current).toBe(false);
  unmount();
});

it("切换会话不会沿用前一会话的审批状态", async () => {
  const get = vi.fn().mockResolvedValue({ pending: true });
  const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
  vi.spyOn(httpClient.interactions,'getMessagePlanStatus').mockImplementation(get);
  const { result, rerender, unmount } = renderHook(
    ({ conversationId }) =>
      usePendingPlanApproval({
        httpClient,
        conversationId,
        chatList: [message],
        enabled: true,
      }),
    { initialProps: { conversationId: "c1" } },
  );
  await waitFor(() => expect(result.current).toBe(true));
  get.mockImplementation(() => new Promise(() => {}));
  rerender({ conversationId: "c2" });
  expect(result.current).toBe(false);
  unmount();
});

it("从活跃轮工具投影提取待审批消息", () => {
  expect(findPendingPlanApprovalMessage([message])).toBe("m1");
  expect(
    findPendingPlanApprovalMessage([
      { ...message, loading: false, status: ConversationMessageStatus.PENDING },
    ]),
  ).toBe("m1");
});

it.each([
  ConversationMessageStatus.COMPLETED,
  ConversationMessageStatus.INTERRUPTED,
  ConversationMessageStatus.ERROR,
])("%s历史消息的旧等待事件不隐藏输入框", (status) => {
  expect(
    findPendingPlanApprovalMessage([{ ...message, loading: false, status }]),
  ).toBeUndefined();
});

it.each([
  ToolCallStatusEnum.ApprovalResponded,
  ToolCallStatusEnum.ApprovalDenied,
  ToolCallStatusEnum.Timeout,
  ToolCallStatusEnum.Interrupted,
])("%s结束审批后恢复输入", (status) => {
  expect(
    findPendingPlanApprovalMessage([
      {
        ...message,
        assistant: [awaiting, { ...awaiting, status }],
      },
    ]),
  ).toBeUndefined();
});
