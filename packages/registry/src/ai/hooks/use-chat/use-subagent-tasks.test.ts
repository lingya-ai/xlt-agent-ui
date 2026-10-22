// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {ApiError} from "@lingya-ai/agents-sdk/browser";
import { SubagentTaskStatus, type SubagentTask } from "./subagent-schema";
import { createSubagentTask } from "./subagent-test-fixtures";
import { useSubagentTasks } from "./use-subagent-tasks";

const response = (changedTasks: SubagentTask[] = [], overrides = {}) => ({
  activeTasks: [],
  changedTasks,
  nextCursor: "cursor-1",
  pollingRequired: false,
  hasUnreadTerminalResults: false,
  ...overrides,
});
const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

describe("Subagent 独立游标同步", () => {
  it("执行中优先于更新的等待任务，并按执行状态统计执行中数量", async () => {
    const running = createSubagentTask();
    const pending = createSubagentTask({
      taskId: "pending",
      status: SubagentTaskStatus.PENDING,
      createdTime: new Date("2026-10-08T00:00:00Z"),
    });
    const get = vi.fn().mockResolvedValue(response([pending, running]));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentTasks({
        httpClient: client,
        conversationId: "parent",
        ready: true,
        executionActive: false,
      }),
    );
    await settle();
    expect(hook.result.current.tasks.map((task) => task.taskId)).toEqual([
      "task-1",
      "pending",
    ]);
    expect(hook.result.current.activeCount).toBe(1);
  });
  beforeEach(() => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("即使 pollingRequired 为 false，满页也持续排空并恢复全部历史终态", async () => {
    const completed = (taskId: string) =>
      createSubagentTask({ taskId, status: SubagentTaskStatus.COMPLETED });
    const get = vi
      .fn()
      .mockResolvedValueOnce(
        response(Array.from({ length: 50 }, (_, i) => completed(String(i)))),
      )
      .mockResolvedValueOnce(
        response([completed("50")], {
          nextCursor: "cursor-2",
          hasUnreadTerminalResults: true,
        }),
      );
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentTasks({
        httpClient: client,
        conversationId: "parent",
        ready: true,
        executionActive: false,
      }),
    );
    await settle();
    expect(hook.result.current.tasks).toHaveLength(51);
    expect(hook.result.current.activeCount).toBe(0);
    expect(hook.result.current.hasUnreadTerminalResults).toBe(true);
    expect(get).toHaveBeenNthCalledWith(
      1,
      "parent",
      expect.objectContaining({ size: 50 }),
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "parent",
      expect.objectContaining({ cursor: "cursor-1", size: 50 }),
    );
  });

  it("主消息结束后仍按后端要求轮询，任务终态保留并停止轮询", async () => {
    vi.useFakeTimers();
    const running = createSubagentTask();
    const completed = createSubagentTask({
      status: SubagentTaskStatus.COMPLETED,
    });
    const get = vi
      .fn()
      .mockResolvedValue(
        response([running], { activeTasks: [running], pollingRequired: true }),
      );
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
    const hook = renderHook(
      ({ active }) =>
        useSubagentTasks({
          httpClient: client,
          conversationId: "parent",
          ready: true,
          executionActive: active,
        }),
      { initialProps: { active: true } },
    );
    await settle();
    hook.rerender({ active: false });
    await settle();
    const count = get.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(3001));
    expect(get.mock.calls.length).toBeGreaterThan(count);
    get.mockResolvedValue(response([completed]));
    await act(() => vi.advanceTimersByTimeAsync(3001));
    expect(hook.result.current.tasks).toEqual([completed]);
    const terminalCount = get.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(get).toHaveBeenCalledTimes(terminalCount);
  });

  it("取消响应即时合并，仍在停止时不伪造取消终态", async () => {
    const get = vi.fn().mockResolvedValue(response([createSubagentTask()]));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentTasks({
        httpClient: client,
        conversationId: "parent",
        ready: true,
        executionActive: false,
      }),
    );
    await settle();
    act(() =>
      hook.result.current.updateTask(
        createSubagentTask({ phase: "cancelling", cancellable: false }),
      ),
    );
    expect(hook.result.current.tasks[0]?.phase).toBe("cancelling");
    expect(hook.result.current.tasks[0]?.status).toBe(
      SubagentTaskStatus.RUNNING,
    );
    act(() =>
      hook.result.current.updateTask(
        createSubagentTask({ parentConversationId: "other" }),
      ),
    );
    expect(hook.result.current.tasks[0]?.phase).toBe("cancelling");
  });

  it.each(["会话", "客户端", "权限"])(
    "%s 切换后旧响应不会回写，并重置游标和任务",
    async (mode) => {
      let resolveOld: (value: ReturnType<typeof response>) => void = () =>
        undefined;
      const get = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveOld = resolve;
            }),
        )
        .mockResolvedValue(response());
      const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
      const newClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(newClient.messages,'syncConversationSubagents').mockImplementation(get);
      const hook = renderHook(
        (props) => useSubagentTasks({ ...props, executionActive: false }),
        {
          initialProps: {
            httpClient: client,
            conversationId: "parent",
            ready: true,
          },
        },
      );
      await settle();
      const oldSignal = get.mock.calls[0]?.[1].signal as AbortSignal;
      hook.rerender({
        httpClient: mode === "客户端" ? newClient : client,
        conversationId: mode === "会话" ? "new" : "parent",
        ready: mode !== "权限",
      });
      await settle();
      await act(async () => resolveOld(response([createSubagentTask()])));
      expect(oldSignal.aborted).toBe(true);
      expect(hook.result.current.tasks).toEqual([]);
      if (mode !== "权限")
        expect(get.mock.calls[1]?.[1]).toMatchObject({ size: 50 });
    },
  );

  it("隐藏页面暂停，恢复可见后沿原游标同步", async () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
    const get = vi
      .fn()
      .mockResolvedValue(
        response([createSubagentTask()], { pollingRequired: true }),
      );
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
    renderHook(() =>
      useSubagentTasks({
        httpClient: client,
        conversationId: "parent",
        ready: true,
        executionActive: false,
      }),
    );
    await settle();
    visibility = "hidden";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    const count = get.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(get).toHaveBeenCalledTimes(count);
    visibility = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await settle();
    expect(get.mock.calls.at(-1)?.[1]).toMatchObject({
      cursor: "cursor-1",
      size: 50,
    });
  });

  it("满页游标不推进时提供重试，刷新错误保留已有任务", async () => {
    const task = createSubagentTask();
    const get = vi.fn().mockResolvedValue(response([task]));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentTasks({
        httpClient: client,
        conversationId: "parent",
        ready: true,
        executionActive: false,
      }),
    );
    await settle();
    get.mockResolvedValue(response(Array.from({ length: 50 }, () => task)));
    await act(async () => hook.result.current.refresh());
    expect(hook.result.current.error).toBeInstanceOf(Error);
    expect(hook.result.current.tasks).toEqual([task]);
  });

  it("后端拒绝游标后从空游标重试，成功后清除错误", async () => {
    const get = vi.fn().mockResolvedValueOnce(response([createSubagentTask()]));
    const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.messages,'syncConversationSubagents').mockImplementation(get);
    const hook = renderHook(() =>
      useSubagentTasks({
        httpClient: client,
        conversationId: "parent",
        ready: true,
        executionActive: false,
      }),
    );
    await settle();
    const error = new ApiError("GET", "/subagents/sync", 400, "", {code: "ai.subagent.cursor_invalid"});
    get.mockRejectedValueOnce(error).mockResolvedValueOnce(response());
    await act(async () => hook.result.current.refresh());
    expect(get.mock.calls.at(-1)?.[1]).toMatchObject({ size: 50 });
    expect(hook.result.current.error).toBeUndefined();
  });
});
