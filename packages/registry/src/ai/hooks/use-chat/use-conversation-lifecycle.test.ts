// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {AgentsClient,ConversationSummaryFromJSON} from "@lingya-ai/agents-sdk/browser";
import { useConversationLifecycle } from "./use-conversation-lifecycle";
import { notifyConversationLifecycleChanged } from "./conversation-lifecycle-events";
import { ConversationStatus } from "./use-conversation-operations";

vi.mock("../../../i18n/runtime", () => ({
  useAgentMessages: () => ({ restoreSuccess: { value: "已取消归档" } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function client() {
  const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
  const get = vi.spyOn(httpClient.conversations, "getConversationSummary");
  const patch = vi.spyOn(httpClient.conversations, "updateConversationStatus").mockResolvedValue(undefined);
  return { httpClient, get, patch };
}

it("归档历史先关闭发送，取消归档确认后恢复可写", async () => {
  const { httpClient, get, patch } = client();
  get.mockResolvedValue(ConversationSummaryFromJSON({ status: ConversationStatus.ARCHIVED,usage:{inputTokens:0,outputTokens:0,totalTokens:0} }));
  const { result } = renderHook(() =>
    useConversationLifecycle({
      httpClient,
      conversationId: "a",
      enabled: true,
    }),
  );
  expect(result.current.blocked).toBe(true);
  await waitFor(() => expect(result.current.archived).toBe(true));
  expect(get).toHaveBeenCalledWith(
    "a",
    {signal: undefined},
  );
  patch.mockImplementation(async () => {
    get.mockResolvedValue(ConversationSummaryFromJSON({ status: ConversationStatus.ACTIVE,usage:{inputTokens:0,outputTokens:0,totalTokens:0} }));
  });
  await act(() => result.current.restore());
  expect(patch).toHaveBeenCalledWith(
    "a",
    { status: ConversationStatus.ACTIVE },
    {signal: undefined},
  );
  await waitFor(() => expect(result.current.blocked).toBe(false));
});

it("取消归档失败保留已确认的归档状态", async () => {
  const { httpClient, get, patch } = client();
  get.mockResolvedValue(ConversationSummaryFromJSON({ status: ConversationStatus.ARCHIVED,usage:{inputTokens:0,outputTokens:0,totalTokens:0} }));
  const { result } = renderHook(() =>
    useConversationLifecycle({
      httpClient,
      conversationId: "a",
      enabled: true,
    }),
  );
  await waitFor(() => expect(result.current.archived).toBe(true));
  patch.mockRejectedValue(new Error("恢复失败"));
  await act(async () => {
    await expect(result.current.restore()).rejects.toThrow("恢复失败");
  });
  expect(result.current.archived).toBe(true);
  expect(result.current.blocked).toBe(true);
});

it("同页通知和跨标签页状态变化重新读取摘要", async () => {
  const { httpClient, get } = client();
  get.mockResolvedValue(ConversationSummaryFromJSON({ status: ConversationStatus.ACTIVE,usage:{inputTokens:0,outputTokens:0,totalTokens:0} }));
  const { result } = renderHook(() =>
    useConversationLifecycle({
      httpClient,
      conversationId: "a",
      enabled: true,
    }),
  );
  await waitFor(() => expect(result.current.blocked).toBe(false));
  get.mockResolvedValue(ConversationSummaryFromJSON({ status: ConversationStatus.ARCHIVED,usage:{inputTokens:0,outputTokens:0,totalTokens:0} }));
  act(() => notifyConversationLifecycleChanged());
  await waitFor(() => expect(result.current.archived).toBe(true));
  get.mockResolvedValue(ConversationSummaryFromJSON({ status: ConversationStatus.ACTIVE,usage:{inputTokens:0,outputTokens:0,totalTokens:0} }));
  act(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ai-conversation-lifecycle",
        newValue: "changed",
      }),
    ),
  );
  await waitFor(() => expect(result.current.blocked).toBe(false));
});

it("切换会话后不能使用上一会话的正常状态开放发送", async () => {
  const { httpClient, get } = client();
  get.mockResolvedValue(ConversationSummaryFromJSON({ status: ConversationStatus.ACTIVE,usage:{inputTokens:0,outputTokens:0,totalTokens:0} }));
  const { result, rerender } = renderHook(
    ({ id }) =>
      useConversationLifecycle({
        httpClient,
        conversationId: id,
        enabled: true,
      }),
    { initialProps: { id: "a" } },
  );
  await waitFor(() => expect(result.current.blocked).toBe(false));
  get.mockImplementation(() => new Promise(() => {}));
  rerender({ id: "b" });
  expect(result.current.blocked).toBe(true);
});
