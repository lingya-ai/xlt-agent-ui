import {ConversationMessageFromJSON} from '@lingya-ai/agents-sdk/browser';
// @vitest-environment jsdom
import { useCallback, useRef, useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {ApiError} from "@lingya-ai/agents-sdk/browser";
import {ConversationMessageStatus} from "./conversation-message";
import { SubagentTaskStatus } from "./subagent-schema";
import { createSubagentTask } from "./subagent-test-fixtures";
import type { ChatItem } from "./types";
import { useSubagentConversation } from "./use-subagent-conversation";

const mocks = vi.hoisted(() => ({ abort: vi.fn(), subscribe: vi.fn() }));
vi.mock("./use-chat-messages", () => ({
  useChatMessages: () => {
    const [chatList, setChatList] = useState<ChatItem[]>([]);
    const chatListRef = useRef(chatList);
    const updateChatList = useCallback((next: ChatItem[]) => {
      chatListRef.current = next;
      setChatList(next);
    }, []);
    return {
      chatList,
      chatListRef,
      updateChatList,
      resubscribeStream: mocks.subscribe,
      abortAllStreams: mocks.abort,
    };
  },
}));

const metadata = (status: ConversationMessageStatus) =>
  ConversationMessageFromJSON({
    messageId: "child-message",
    userMessage: { text: "检索资料" },
    status,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    executionTimeMillis: 0,
    processingSteps: 0,
    totalToolCalls: 0,
    createdTime: "2026-10-07T00:00:00Z",
    lastUpdateTime: "2026-10-07T00:00:00Z",
  });
const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

describe("选中 Subagent 的只读详情", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("没有子消息 ID 时等待准入，不订阅或读取结果", async () => {
    const get = vi.fn();
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentConversation({
        httpClient: client,
        task: createSubagentTask({ childMessageId: null }),
      }),
    );
    await settle();
    expect(hook.result.current.waiting).toBe(true);
    expect(get).not.toHaveBeenCalled();
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("排队只查询元数据，开始执行后订阅现有消息且普通更新不重复订阅", async () => {
    vi.useFakeTimers();
    const get = vi
      .fn()
      .mockResolvedValueOnce(metadata(ConversationMessageStatus.QUEUED))
      .mockResolvedValue(metadata(ConversationMessageStatus.PENDING));
    const post = vi.fn();
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    vi.spyOn(client.events,'getChatEventsBatch').mockImplementation(post);
    const hook = renderHook(
      ({ description }) =>
        useSubagentConversation({
          httpClient: client,
          task: createSubagentTask({ description }),
        }),
      { initialProps: { description: "检索资料" } },
    );
    await settle();
    expect(hook.result.current.waiting).toBe(true);
    expect(mocks.subscribe).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(3001));
    expect(mocks.subscribe).toHaveBeenCalledWith({
      conversationId: "child",
      messageId: "child-message",
    });
    expect(hook.result.current.waiting).toBe(false);
    hook.rerender({ description: "检索资料更新" });
    await settle();
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(
      get.mock.calls.every((call) => !String(call[0]).endsWith("/result")),
    ).toBe(true);
  });

  it("历史终态只恢复对话事件，不请求执行结果", async () => {
    const get = vi
      .fn()
      .mockResolvedValue(metadata(ConversationMessageStatus.COMPLETED));
    const post = vi.fn().mockResolvedValue({
      records: [{ messageId: "child-message", events: [] }],
      skipped: [],
    });
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    vi.spyOn(client.events,'getChatEventsBatch').mockImplementation(post);
    const hook = renderHook(() =>
      useSubagentConversation({
        httpClient: client,
        task: createSubagentTask({ status: SubagentTaskStatus.COMPLETED }),
      }),
    );
    await settle();
    expect(post).toHaveBeenCalledWith(
      { conversationId: "child", messageIds: ["child-message"] },
      expect.objectContaining({signal: expect.anything()}),
    );
    expect(hook.result.current.chatList[0]).toMatchObject({
      id: "child-message",
      loaded: true,
      loading: false,
    });
    expect(
      get.mock.calls.every(
        ([conversationId,messageId]) => conversationId === "child" && messageId === "child-message",
      ),
    ).toBe(true);
    expect(mocks.subscribe).not.toHaveBeenCalled();
    await act(async () => hook.result.current.reload());
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("历史尚未归档时等待后重试，不把空事件当作完整历史", async () => {
    vi.useFakeTimers();
    const get = vi
      .fn()
      .mockResolvedValue(metadata(ConversationMessageStatus.COMPLETED));
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        records: [],
        skipped: [{ messageId: "child-message", reason: "HISTORY_NOT_READY" }],
      })
      .mockResolvedValue({
        records: [{ messageId: "child-message", events: [] }],
        skipped: [],
      });
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    vi.spyOn(client.events,'getChatEventsBatch').mockImplementation(post);
    const hook = renderHook(() =>
      useSubagentConversation({
        httpClient: client,
        task: createSubagentTask({ status: SubagentTaskStatus.COMPLETED }),
      }),
    );
    await settle();
    expect(hook.result.current.chatList[0]?.loaded).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(3001));
    expect(hook.result.current.loaded).toBe(true);
    expect(hook.result.current.waiting).toBe(false);
  });

  it("已结束且无子消息的任务不请求结果或启动结果轮询", async () => {
    vi.useFakeTimers();
    const get = vi.fn();
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentConversation({
        httpClient: client,
        task: createSubagentTask({
          status: SubagentTaskStatus.COMPLETED,
          childMessageId: null,
        }),
      }),
    );
    await settle();
    expect(hook.result.current.loaded).toBe(true);
    expect(hook.result.current.waiting).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(get).not.toHaveBeenCalled();
  });

  it("准入前取消的子任务不报对话错误", async () => {
    const get = vi.fn().mockRejectedValue(new ApiError("GET", "/messages", 404));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentConversation({
        httpClient: client,
        task: createSubagentTask({ status: SubagentTaskStatus.CANCELLED }),
      }),
    );
    await settle();
    expect(hook.result.current.error).toBeUndefined();
    expect(hook.result.current.loaded).toBe(true);
    expect(hook.result.current.waiting).toBe(false);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("任务切换时中止请求并隔离迟到消息，离开详情停止订阅", async () => {
    let resolveOld: (value: ReturnType<typeof metadata>) => void = () =>
      undefined;
    const get = vi.fn().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    const hook = renderHook(
      ({ task }) =>
        useSubagentConversation({
          httpClient: client,
          task,
        }),
      {
        initialProps: { task: createSubagentTask() },
      },
    );
    await settle();
    const signal = get.mock.calls[0]?.[2].signal as AbortSignal;
    hook.rerender({
      task: createSubagentTask({ taskId: "other", childMessageId: null }),
    });
    await settle();
    await act(async () =>
      resolveOld(metadata(ConversationMessageStatus.PENDING)),
    );
    expect(signal.aborted).toBe(true);
    expect(hook.result.current.chatList).toEqual([]);
    expect(mocks.subscribe).not.toHaveBeenCalled();
    const aborts = mocks.abort.mock.calls.length;
    hook.unmount();
    expect(mocks.abort.mock.calls.length).toBeGreaterThan(aborts);
  });

  it("隐藏页面停止详情流，恢复后重新查询元数据订阅", async () => {
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
    const get = vi
      .fn()
      .mockResolvedValue(metadata(ConversationMessageStatus.PENDING));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
    renderHook(() =>
      useSubagentConversation({
        httpClient: client,
        task: createSubagentTask(),
      }),
    );
    await settle();
    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(mocks.abort).toHaveBeenCalled();
    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await settle();
    expect(mocks.subscribe).toHaveBeenCalledTimes(2);
  });
});
