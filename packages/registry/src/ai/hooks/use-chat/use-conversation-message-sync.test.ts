// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import type { ConversationMessageOutput } from "./conversation-message";
import {
  consumeMessageSync,
  useConversationMessageSync,
} from "./use-conversation-message-sync";
const message = (id: string) =>
  ({ messageId: id }) as ConversationMessageOutput;
const page = (id: string, hasMore = false) => ({
  messages: [message(id)],
  nextMessageId: id,
  hasMore,
});
let visibility = "visible";
beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});
it("连续读取多个自动轮和人工回应消息，合并成功后逐页推进", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce(page("auto1", true))
    .mockResolvedValueOnce(page("auto2", true))
    .mockResolvedValueOnce(page("human"));
  const merge = vi.fn().mockResolvedValue(undefined);
  const advance = vi.fn();
  await consumeMessageSync("history", read, merge, () => true, advance);
  expect(read.mock.calls.map((call) => call[0])).toEqual([
    "history",
    "auto1",
    "auto2",
  ]);
  expect(advance.mock.calls.map((call) => call[0])).toEqual([
    "auto1",
    "auto2",
    "human",
  ]);
  expect(merge).toHaveBeenCalledTimes(3);
});
it("合并失败或返回 false 时不推进游标，可重试同一页", async () => {
  const read = vi.fn().mockResolvedValue(page("auto1"));
  const advance = vi.fn();
  await expect(
    consumeMessageSync(
      "old",
      read,
      vi.fn().mockRejectedValue(new Error("回放失败")),
      () => true,
      advance,
    ),
  ).rejects.toThrow();
  await consumeMessageSync(
    "old",
    read,
    vi.fn().mockResolvedValue(false),
    () => true,
    advance,
  );
  expect(advance).not.toHaveBeenCalled();
});
it("会话切换后丢弃旧页，避免合并到新会话", async () => {
  let resolve!: (value: ReturnType<typeof page>) => void;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue(page("new"));
  const merge = vi.fn().mockResolvedValue(undefined);
  const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
  vi.spyOn(client.messages,'syncConversationMessages').mockImplementation(read);
  const hook = renderHook(
    ({ id }) =>
      useConversationMessageSync({
        httpClient: client,
        conversationId: id,
        ready: true,
        initialCursorMessageId: null,
        fast: false,
        refreshKey: 0,
        onSynchronize: merge,
      }),
    { initialProps: { id: "old" } },
  );
  await act(async () => {
    await Promise.resolve();
  });
  hook.rerender({ id: "new" });
  await act(async () => {
    resolve(page("old"));
    await Promise.resolve();
  });
  expect(merge).not.toHaveBeenCalledWith([message("old")]);
  expect(merge).toHaveBeenCalledWith([message("new")]);
});
it("页面隐藏停止轮询，重新可见立即追赶；活动与闲置使用 3/15 秒", async () => {
  vi.useFakeTimers();
  const read = vi
    .fn()
    .mockResolvedValue({ messages: [], nextMessageId: null, hasMore: false });
  const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
  vi.spyOn(client.messages,'syncConversationMessages').mockImplementation(read);
  renderHook(() =>
    useConversationMessageSync({
      httpClient: client,
      conversationId: "c",
      ready: true,
      fast: true,
      refreshKey: 0,
      onSynchronize: vi.fn().mockResolvedValue(undefined),
    }),
  );
  await act(async () => {
    await Promise.resolve();
  });
  const count = read.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(3001));
  expect(read.mock.calls.length).toBeGreaterThan(count);
  visibility = "hidden";
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenCount = read.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(16000));
  expect(read).toHaveBeenCalledTimes(hiddenCount);
  visibility = "visible";
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(read.mock.calls.length).toBeGreaterThan(hiddenCount);
});
