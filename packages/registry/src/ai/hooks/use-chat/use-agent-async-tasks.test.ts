import {AsyncTaskFromJSON} from '@lingya-ai/agents-sdk/browser';
// @vitest-environment jsdom
import {act, cleanup, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import type {ConversationMessageOutput} from "./conversation-message";
import {useAgentAsyncTasks} from "./use-agent-async-tasks";

const task = AsyncTaskFromJSON({
  taskId: "t",
  title: "转写",
  targetMessageId: "m",
  status: "RUNNING",
  notificationStatus: "WAITING",
  lastUpdateTime: "2026-09-08T09:00:00Z",
});
const notification = (messageId: string) => ({messageId}) as ConversationMessageOutput;
const response = (overrides: Partial<{
  activeTasks: typeof task[];
  notificationMessages: ConversationMessageOutput[];
  nextMessageId: string | null;
  hasMore: boolean;
  pollingRequired: boolean;
}> = {}) => ({
  activeTasks: [],
  notificationMessages: [],
  nextMessageId: null,
  hasMore: false,
  pollingRequired: false,
  ...overrides,
});
const settle = () => act(async () => { await Promise.resolve(); });

describe("异步任务增量同步", () => {
  beforeEach(() => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("使用历史锚点请求增量接口并只暴露活动任务", async () => {
    const get = vi.fn().mockResolvedValue(response({activeTasks: [task], nextMessageId: "history-message"}));
    const synchronize = vi.fn().mockResolvedValue(undefined);
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationAsyncTasks').mockImplementation(get);
    const hook = renderHook(() => useAgentAsyncTasks({
      httpClient: client,
      conversationId: "c",
      initialCursorMessageId: "history-message",
      ready: true,
      executionActive: false,
      onSynchronize: synchronize,
    }));

    await settle();

    expect(hook.result.current.tasks).toEqual([task]);
    expect(get).toHaveBeenCalledWith("c", expect.objectContaining({afterMessageId: "history-message", size: 50,
    }));
    expect(synchronize).toHaveBeenCalledWith([]);
  });

  it("会话执行期间按固定周期查询且普通重渲染不会追加请求", async () => {
    vi.useFakeTimers();
    const get = vi.fn().mockResolvedValue(response());
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationAsyncTasks').mockImplementation(get);
    const synchronize = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(({renderMarker}) => {
      void renderMarker;
      return useAgentAsyncTasks({
        httpClient: client,
        conversationId: "c",
        initialCursorMessageId: "cursor",
        ready: true,
        executionActive: true,
        onSynchronize: synchronize,
      });
    }, {initialProps: {renderMarker: 0}});
    await settle();
    const initialRequests = get.mock.calls.length;

    hook.rerender({renderMarker: 1});
    hook.rerender({renderMarker: 2});
    await settle();
    expect(get).toHaveBeenCalledTimes(initialRequests);

    await act(() => vi.advanceTimersByTimeAsync(3001));
    expect(get.mock.calls.length).toBeGreaterThan(initialRequests);
  });

  it("普通消息进入终态时执行最终同步并停止轮询", async () => {
    vi.useFakeTimers();
    const get = vi.fn().mockResolvedValue(response());
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationAsyncTasks').mockImplementation(get);
    const synchronize = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(({active}) => useAgentAsyncTasks({
      httpClient: client,
      conversationId: "c",
      initialCursorMessageId: "cursor",
      ready: true,
      executionActive: active,
      onSynchronize: synchronize,
    }), {initialProps: {active: true}});
    await settle();

    hook.rerender({active: false});
    await settle();
    const afterFinalSync = get.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(9000));

    expect(get).toHaveBeenCalledTimes(afterFinalSync);
  });

  it("连续排空分页并在消息合并成功后推进游标", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(response({
        notificationMessages: [notification("notification-1")],
        nextMessageId: "notification-1",
        hasMore: true,
        pollingRequired: true,
      }))
      .mockResolvedValueOnce(response({
        notificationMessages: [notification("notification-2")],
        nextMessageId: "notification-2",
      }));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationAsyncTasks').mockImplementation(get);
    const synchronize = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAgentAsyncTasks({
      httpClient: client,
      conversationId: "c",
      initialCursorMessageId: "cursor",
      ready: true,
      executionActive: false,
      onSynchronize: synchronize,
    }));

    await settle();
    await settle();

    expect(synchronize).toHaveBeenNthCalledWith(1, [notification("notification-1")]);
    expect(synchronize).toHaveBeenNthCalledWith(2, [notification("notification-2")]);
    expect(get).toHaveBeenNthCalledWith(2, "c", expect.objectContaining({afterMessageId: "notification-1", size: 50,
    }));
  });

  it("消息暂不能合并时不推进游标并在下一轮重试", async () => {
    vi.useFakeTimers();
    const get = vi.fn().mockResolvedValue(response({
      notificationMessages: [notification("notification-1")],
      nextMessageId: "notification-1",
    }));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationAsyncTasks').mockImplementation(get);
    const synchronize = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(undefined);
    renderHook(() => useAgentAsyncTasks({
      httpClient: client,
      conversationId: "c",
      initialCursorMessageId: "cursor",
      ready: true,
      executionActive: false,
      onSynchronize: synchronize,
    }));
    await settle();

    await act(() => vi.advanceTimersByTimeAsync(3001));
    await settle();

    expect(get).toHaveBeenNthCalledWith(2, "c", expect.objectContaining({afterMessageId: "cursor", size: 50,
    }));
  });

  it("旧会话延迟响应不会覆盖新会话", async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const get = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValue(response());
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationAsyncTasks').mockImplementation(get);
    const synchronize = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(({id}) => useAgentAsyncTasks({
      httpClient: client,
      conversationId: id,
      initialCursorMessageId: "cursor",
      ready: true,
      executionActive: false,
      onSynchronize: synchronize,
    }), {initialProps: {id: "old"}});
    await settle();

    hook.rerender({id: "new"});
    await settle();
    await act(async () => resolveOld(response({activeTasks: [task]})));

    expect(hook.result.current.tasks).toEqual([]);
  });

  it("页面重新可见时从原游标继续同步", async () => {
    let visibility = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility as DocumentVisibilityState);
    const get = vi.fn().mockResolvedValue(response());
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationAsyncTasks').mockImplementation(get);
    renderHook(() => useAgentAsyncTasks({
      httpClient: client,
      conversationId: "c",
      initialCursorMessageId: "cursor",
      ready: true,
      executionActive: false,
      onSynchronize: vi.fn().mockResolvedValue(undefined),
    }));
    await settle();
    expect(get).not.toHaveBeenCalled();

    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await settle();

    expect(get).toHaveBeenCalledTimes(1);
  });
});
