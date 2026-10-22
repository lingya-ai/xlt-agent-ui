import {ConversationReadReceiptFromJSON} from '@lingya-ai/agents-sdk/browser';
// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import { useConversationActivity } from "./use-conversation-activity";
import {type ConversationActivity, type ConversationReadReceiptActivity} from "./conversation-activity";

const idle: ConversationActivity = {
  conversationId: "a",
  executionStatus: "IDLE",
  activeMessageId: null,
  executionEpoch: "1",
  executionStartedTime: null,
  latestTerminalMessageId: "m1",
  latestTerminalTime: new Date("2026-09-05T00:00:00Z"),
  hasUnreadCompletion: true,
  requiresUserConfirmation: false,
};
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
let documentVisibility: DocumentVisibilityState = "visible";

describe("会话活动生命周期", () => {
  beforeEach(() => {
    documentVisibility = "visible";
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => documentVisibility,
    );
    vi.spyOn(document, "hidden", "get").mockImplementation(
      () => documentVisibility !== "visible",
    );
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup(active: string | null = null, readable: string[] = [], readReceiptEnabled = true) {
    const get = vi.fn().mockResolvedValue({ conversationIds: ["a"] });
    const post = vi.fn().mockResolvedValue({ records: [idle] });
    const put = vi.fn().mockResolvedValue(
      ConversationReadReceiptFromJSON({
        ...idle,
        hasUnreadCompletion: false,
      }),
    );
    const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(httpClient.conversations,'listActiveConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'listUnreadConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'queryConversationActivities').mockImplementation(post);
    vi.spyOn(httpClient.conversations,'markConversationRead').mockImplementation(put);
    const hook = renderHook(
      ({ active, readable }) =>
        useConversationActivity({
          httpClient,
          conversationIds: ["a"],
          activeConversationId: active,
          readableMessageIds: readable,
          enabled: true,
          readReceiptEnabled,
        }),
      { initialProps: { active, readable } },
    );
    return { ...hook, get, post, put };
  }

  it("只读用户保持活动和未读状态，不发送自动或手动回执", async () => {
    const h = setup("a", ["m1"], false);
    await act(() => h.result.current.refresh(["a"]));
    await settle();
    await act(() => h.result.current.markRead("a", "m1"));
    expect(h.put).not.toHaveBeenCalled();
    expect(h.result.current.activityByConversationId.get("a")?.hasUnreadCompletion).toBe(true);
  });

  it("先发现活动会话，再按返回 ID 查询活动摘要", async () => {
    const h = setup();
    await settle();
    expect(h.post).not.toHaveBeenCalled();
    await act(() => h.result.current.refreshActive());
    expect(h.get).toHaveBeenCalledWith({signal: undefined});
    expect(h.post).toHaveBeenCalledWith(
      { conversationIds: ["a"] },
      {signal: undefined},
    );
  });

  it("空闲会话仍可强制刷新", async () => {
    const h = setup();
    await settle();
    const before = h.post.mock.calls.length;
    await act(() => h.result.current.refresh(["a"]));
    expect(h.post.mock.calls.length).toBeGreaterThan(before);
  });

  it("使用专用接口恢复未读会话集合", async () => {
    const h = setup();
    await settle();

    await act(() => h.result.current.refreshUnread());

    expect(h.get).toHaveBeenCalledWith({signal: undefined});
    expect([...h.result.current.unreadConversationIds]).toEqual(["a"]);
  });

  it("删除会话时立即移除对应未读状态", async () => {
    const h = setup();
    await act(() => h.result.current.refreshUnread());

    act(() => h.result.current.removeConversation("a"));

    expect(h.result.current.unreadConversationIds.has("a")).toBe(false);
  });

  it("未读查询只接收最新响应，失败时保留已有集合", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let resolveFirst: (value: { conversationIds: string[] }) => void = () => {};
    const get = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ conversationIds: ["b"] })
      .mockRejectedValueOnce(new Error("未读查询失败"));
    const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(httpClient.conversations,'listActiveConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'listUnreadConversations').mockImplementation(get);
    const hook = renderHook(() =>
      useConversationActivity({
        httpClient,
        conversationIds: ["a", "b"],
        activeConversationId: null,
        enabled: true,
      }),
    );

    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.refreshUnread();
    });
    await settle();
    await act(() => hook.result.current.refreshUnread());
    await act(async () => {
      resolveFirst({ conversationIds: ["a"] });
      await expect(first).rejects.toThrow("Request was canceled");
    });
    expect([...hook.result.current.unreadConversationIds]).toEqual(["b"]);

    await expect(
      act(() => hook.result.current.refreshUnread()),
    ).rejects.toThrow("未读查询失败");
    expect([...hook.result.current.unreadConversationIds]).toEqual(["b"]);
  });

  it("只有最新终态内容就绪后才确认已读", async () => {
    const h = setup("a");
    await settle();
    await act(() => h.result.current.refreshUnread());
    expect(h.result.current.unreadConversationIds.has("a")).toBe(true);
    expect(h.put).not.toHaveBeenCalled();
    h.rerender({ active: "a", readable: ["old"] });
    await settle();
    expect(h.put).not.toHaveBeenCalled();
    h.rerender({ active: "a", readable: ["m1"] });
    await settle();
    expect(h.put).toHaveBeenCalledTimes(1);
    expect(h.result.current.unreadConversationIds.has("a")).toBe(false);
  });

  it("失焦恢复后打开空闲会话可以确认已读", async () => {
    const h = setup();
    await settle();
    act(() => window.dispatchEvent(new Event("blur")));
    act(() => window.dispatchEvent(new Event("focus")));
    h.rerender({ active: "a", readable: ["m1"] });
    await settle();
    expect(h.put).toHaveBeenCalledTimes(1);
  });

  it("快速完成不会丢弃终态确认，发送前保存的回调也有效", async () => {
    const h = setup();
    await settle();
    const complete = h.result.current.handleConversationComplete;
    let resolveQuery: (value: {
      records: ConversationActivity[];
    }) => void = () => {};
    h.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve;
        }),
    );
    act(() => h.result.current.handleConversationStart("a", "m2"));
    await settle();
    h.post.mockResolvedValue({
      records: [
        { ...idle, executionEpoch: "2", latestTerminalMessageId: "m2" },
      ],
    });
    let completion: Promise<void>;
    act(() => {
      completion = complete("a", "m2");
    });
    await act(async () => {
      resolveQuery({ records: [idle] });
      await completion;
    });
    expect(
      h.result.current.activityByConversationId.get("a")
        ?.latestTerminalMessageId,
    ).toBe("m2");
    expect(h.get).toHaveBeenCalledWith({signal: undefined});
    expect(h.result.current.unreadConversationIds.has("a")).toBe(true);
  });

  it("旧快照不能满足重新聚焦后的已读资格", async () => {
    const h = setup();
    await settle();
    let resolve: (value: {
      records: ConversationActivity[];
    }) => void = () => {};
    h.post.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    h.rerender({ active: "a", readable: ["m1"] });
    await settle();
    act(() => window.dispatchEvent(new Event("blur")));
    act(() => window.dispatchEvent(new Event("focus")));
    let resolveFresh: (value: {
      records: ConversationActivity[];
    }) => void = () => {};
    h.post.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveFresh = done;
        }),
    );
    await act(async () => resolve({ records: [idle] }));
    expect(h.put).not.toHaveBeenCalled();
    await act(async () => resolveFresh({ records: [idle] }));
    expect(h.put).toHaveBeenCalledTimes(1);
  });

  it("回执失败回滚且不连续重试，强制同步成功后重试", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = setup();
    await settle();
    await act(() => h.result.current.refreshUnread());
    h.put.mockRejectedValueOnce(new Error("回执失败"));
    h.rerender({ active: "a", readable: ["m1"] });
    await settle();
    expect(h.put).toHaveBeenCalledTimes(1);
    expect(
      h.result.current.activityByConversationId.get("a")?.hasUnreadCompletion,
    ).toBe(true);
    expect(h.result.current.unreadConversationIds.has("a")).toBe(true);
    await settle();
    expect(h.put).toHaveBeenCalledTimes(1);
    await act(() => h.result.current.refresh(["a"]));
    expect(h.put).toHaveBeenCalledTimes(2);
  });

  it("不同会话的回执串行，旧回执不能隐藏新会话未读", async () => {
    const post = vi.fn().mockResolvedValue({
      records: [
        idle,
        { ...idle, conversationId: "b", latestTerminalMessageId: "b1" },
      ],
    });
    let resolveA: (value: ConversationReadReceiptActivity) => void = () => {};
    const put = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolveA = done;
          }),
      )
      .mockResolvedValue(
        ConversationReadReceiptFromJSON({
          ...idle,
          conversationId: "b",
          latestTerminalMessageId: "b1",
          hasUnreadCompletion: false,
        }),
      );
    const get = vi.fn().mockResolvedValue({ conversationIds: ["a", "b"] });
    const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(httpClient.conversations,'listActiveConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'listUnreadConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'queryConversationActivities').mockImplementation(post);
    vi.spyOn(httpClient.conversations,'markConversationRead').mockImplementation(put);
    const { result, rerender } = renderHook(
      ({ active }) =>
        useConversationActivity({
          httpClient,
          conversationIds: ["a", "b"],
          activeConversationId: active,
          readableMessageIds: active === "a" ? ["m1"] : ["b1"],
          enabled: true,
        }),
      { initialProps: { active: "a" } },
    );
    await settle();
    expect(put).toHaveBeenCalledTimes(1);
    rerender({ active: "b" });
    await settle();
    expect(put).toHaveBeenCalledTimes(1);
    expect(
      result.current.activityByConversationId.get("b")?.hasUnreadCompletion,
    ).toBe(true);
    await act(async () =>
      resolveA(
        ConversationReadReceiptFromJSON({
          ...idle,
          hasUnreadCompletion: false,
        }),
      ),
    );
    expect(put).toHaveBeenCalledTimes(2);
    expect(
      result.current.activityByConversationId.get("b")?.hasUnreadCompletion,
    ).toBe(false);
  });

  it("后台终态变化只通知一次，首次摘要不通知", async () => {
    const onTerminalChange = vi.fn();
    const post = vi.fn().mockResolvedValue({ records: [idle] });
    const get = vi.fn().mockResolvedValue({ conversationIds: ["a"] });
    const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(httpClient.conversations,'listActiveConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'listUnreadConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'queryConversationActivities').mockImplementation(post);
    const { result } = renderHook(() =>
      useConversationActivity({
        httpClient,
        conversationIds: ["a"],
        activeConversationId: null,
        enabled: true,
        onTerminalChange,
      }),
    );
    await act(() => result.current.refreshActive());
    expect(onTerminalChange).not.toHaveBeenCalled();
    post.mockResolvedValue({
      records: [
        { ...idle, executionEpoch: "2", latestTerminalMessageId: "m2" },
      ],
    });
    await act(() => result.current.refresh(["a"]));
    await act(() => result.current.refresh(["a"]));
    expect(onTerminalChange).toHaveBeenCalledExactlyOnceWith("a", "m2");
  });

  it("终态确认失败仍按5秒重试，确认成功后停止轮询", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = setup();
    await settle();
    h.post.mockRejectedValue(new Error("暂时离线"));
    await act(async () => {
      await expect(
        h.result.current.handleConversationComplete("a", "m2"),
      ).rejects.toThrow();
    });
    await settle();
    const calls = h.post.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(h.post).toHaveBeenCalledTimes(calls);
    h.post.mockResolvedValue({
      records: [
        { ...idle, executionEpoch: "2", latestTerminalMessageId: "m2" },
      ],
    });
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(
      h.result.current.activityByConversationId.get("a")
        ?.latestTerminalMessageId,
    ).toBe("m2");
    const confirmedCalls = h.post.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(h.post).toHaveBeenCalledTimes(confirmedCalls);
    h.unmount();
  });

  it.each([
    { pollingWhenHidden: undefined, expectedPolling: false },
    { pollingWhenHidden: true, expectedPolling: true },
  ])(
    "隐藏页面轮询配置为 $pollingWhenHidden 时符合预期",
    async ({ pollingWhenHidden, expectedPolling }) => {
      vi.useFakeTimers();
      const running: ConversationActivity = {
        ...idle,
        executionStatus: "RUNNING",
        activeMessageId: "m2",
        hasUnreadCompletion: false,
      };
      const get = vi.fn().mockResolvedValue({ conversationIds: ["a"] });
      const post = vi.fn().mockResolvedValue({ records: [running] });
      const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(httpClient.conversations,'listActiveConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'listUnreadConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'queryConversationActivities').mockImplementation(post);
      const hook = renderHook(() =>
        useConversationActivity({
          httpClient,
          conversationIds: ["a"],
          activeConversationId: null,
          enabled: true,
          pollingWhenHidden,
        }),
      );

      await act(() => hook.result.current.refreshActive());
      const visibleCalls = post.mock.calls.length;
      act(() => {
        documentVisibility = "hidden";
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(() => vi.advanceTimersByTimeAsync(5_000));

      expect(post.mock.calls.length > visibleCalls).toBe(expectedPolling);
      hook.unmount();
    },
  );

  it("停用时丢弃在途响应，重新启用后可重新发现活动会话", async () => {
    let resolve: (value: {
      records: ConversationActivity[];
    }) => void = () => {};
    const post = vi.fn().mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const get = vi.fn().mockResolvedValue({ conversationIds: ["a"] });
    const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(httpClient.conversations,'listActiveConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'listUnreadConversations').mockImplementation(get);
    vi.spyOn(httpClient.conversations,'queryConversationActivities').mockImplementation(post);
    const h = renderHook(
      ({ enabled }) =>
        useConversationActivity({
          httpClient,
          conversationIds: ["a"],
          activeConversationId: null,
          enabled,
        }),
      { initialProps: { enabled: true } },
    );
    await act(() => h.result.current.refreshUnread());
    expect(h.result.current.unreadConversationIds.has("a")).toBe(true);
    act(() => {
      void h.result.current.refresh(["a"]);
    });
    await settle();
    h.rerender({ enabled: false });
    await act(async () => resolve({ records: [idle] }));
    expect(h.result.current.activityByConversationId.size).toBe(0);
    expect(h.result.current.unreadConversationIds.size).toBe(0);
    post.mockResolvedValue({ records: [idle] });
    h.rerender({ enabled: true });
    await act(() => h.result.current.refreshActive());
    expect(
      h.result.current.activityByConversationId.get("a")?.executionStatus,
    ).toBe("IDLE");
    expect(post.mock.calls.length).toBeGreaterThan(1);
  });
});
