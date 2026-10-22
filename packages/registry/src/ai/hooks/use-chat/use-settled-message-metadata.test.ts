import {ConversationMessageFromJSON} from '@lingya-ai/agents-sdk/browser';
// @vitest-environment jsdom
import {act, cleanup, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {ApiError} from "@lingya-ai/agents-sdk/browser";

import {ConversationMessageStatus} from "./conversation-message";
import type {ChatItem} from "./types";
import {useSettledMessageMetadata} from "./use-settled-message-metadata";
import {AiChatEventTypeEnum, ToolCallStatusEnum} from "./schema";

function fixture(messageId = "m1", status = ConversationMessageStatus.COMPLETED) {
  return ConversationMessageFromJSON({messageId, userMessage: {}, inputTokens: 0, outputTokens: 0,
    totalTokens: 0, processingSteps: 1, totalToolCalls: 1, executionTimeMillis: 42, status,
    createdTime: "2026-01-01T00:00:00Z", lastUpdateTime: "2026-01-01T00:00:01Z"});
}

const get = vi.fn();
const client = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
let items: Map<string, ChatItem>;
const patch = vi.fn((id: string, values: Partial<ChatItem>) => {
  const item = items.get(id);
  if (item) items.set(id, {...item, ...values});
});
function setup() {
  return renderHook(() => useSettledMessageMetadata({httpClient: client,
    getMessage: id => items.get(id), patchMessage: patch}));
}
async function advance(milliseconds: number) {
  await act(async () => {await vi.advanceTimersByTimeAsync(milliseconds);});
}

beforeEach(() => {
  vi.useFakeTimers();
  get.mockReset();
  vi.spyOn(client.messages,'getConversationMessage').mockImplementation(get);
  patch.mockClear();
  items = new Map(["m1", "m2"].map(id => [id, {id, loaded: true, loading: false, assistant: []}]));
});
afterEach(() => {cleanup(); vi.useRealTimers();});

describe("真实End统计补全调度", () => {
  it("相同scope消息只入队一次，完整终态只请求一次", async () => {
    get.mockResolvedValue(fixture());
    const {result} = setup();
    act(() => {result.current.notifyEnd("c1", "m1"); result.current.notifyEnd("c1", "m1");});
    expect(items.get("m1")?.messageStatsPending).toBe(true);
    await advance(10);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("c1", "m1",
      expect.objectContaining({timeoutMs: 5000}));
    expect(items.get("m1")).toMatchObject({messageStatsPending: false, processingSteps: 1, totalToolCalls: 1, executionTimeMillis: 42});
    await advance(10000);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it("可见Message/Think/工具不阻止接纳真实全零终态统计", async () => {
    items.set("m1", {id: "m1", loaded: true, loading: false, assistant: [
      {type: AiChatEventTypeEnum.Message, message: "工作流直接回复"},
      {type: AiChatEventTypeEnum.Think, message: "任务说明"},
      {action: "execute", type: AiChatEventTypeEnum.ToolExecution, toolId: "t1", toolName: "工具", status: ToolCallStatusEnum.Success},
    ]});
    get.mockResolvedValue({...fixture(), processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0});
    const {result} = setup();
    act(() => result.current.notifyEnd("c1", "m1"));
    await advance(10);
    expect(items.get("m1")).toMatchObject({messageStatsPending: false, processingSteps: 0,
      totalToolCalls: 0, executionTimeMillis: 0});
    expect(items.get("m1")?.assistant).toHaveLength(3);
    await advance(10000);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("服务端尚未返回终态最多三次，仍pending不伪装为最终统计", async () => {
    get.mockResolvedValue(fixture("m1", ConversationMessageStatus.PENDING));
    const {result} = setup();
    act(() => result.current.notifyEnd("c1", "m1"));
    await advance(10);
    await advance(600);
    await advance(1100);
    expect(get).toHaveBeenCalledTimes(3);
    expect(items.get("m1")?.messageStatsPending).toBe(true);
    expect(items.get("m1")?.processingSteps).toBeUndefined();
    await advance(10000);
    expect(get).toHaveBeenCalledTimes(3);
  });
  it.each([401, 403])("权限失败%s只请求一次，不重试", async status => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    get.mockRejectedValue(new ApiError("GET", "/messages", status));
    const {result} = setup();
    act(() => result.current.notifyEnd("c1", "m1"));
    await advance(10);
    await advance(10000);
    expect(get).toHaveBeenCalledTimes(1);
    expect(items.get("m1")?.messageStatsPending).toBe(true);
  });

  it("暂时失败按500ms退避后补全，禁用底层额外重试", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    get.mockRejectedValueOnce(new ApiError("GET", "/messages", 503)).mockResolvedValue(fixture());
    const {result} = setup();
    act(() => result.current.notifyEnd("c1", "m1"));
    await advance(10);
    await advance(400);
    expect(get).toHaveBeenCalledTimes(1);
    await advance(200);
    expect(get).toHaveBeenCalledTimes(2);
    expect(items.get("m1")?.messageStatsPending).toBe(false);
  });

  it("多个End串行查询，无并发请求", async () => {
    let resolveFirst: ((value: ReturnType<typeof fixture>) => void) | undefined;
    get.mockImplementationOnce(() => new Promise(resolve => {resolveFirst = resolve;}));
    get.mockResolvedValue(fixture("m2"));
    const {result} = setup();
    act(() => {result.current.notifyEnd("c1", "m1"); result.current.notifyEnd("c1", "m2");});
    await advance(10);
    expect(get).toHaveBeenCalledTimes(1);
    await act(async () => {resolveFirst?.(fixture());});
    await advance(10);
    expect(get).toHaveBeenCalledTimes(2);
    expect(items.get("m2")?.messageStatsPending).toBe(false);
  });
  it("reset期间旧请求结果不写回同ID的新消息，后续scope继续串行", async () => {
    let resolveFirst: ((value: ReturnType<typeof fixture>) => void) | undefined;
    get.mockImplementationOnce(() => new Promise(resolve => {resolveFirst = resolve;}));
    get.mockResolvedValue(fixture());
    const {result} = setup();
    act(() => result.current.notifyEnd("c1", "m1"));
    await advance(10);
    act(() => {result.current.reset(); items.set("m1", {id: "m1", loaded: true, loading: false, assistant: []});
      result.current.notifyEnd("c2", "m1");});
    expect(get).toHaveBeenCalledTimes(1);
    const options = get.mock.calls[0]?.[2] as {signal: AbortSignal};
    expect(options.signal.aborted).toBe(true);
    await act(async () => {resolveFirst?.(fixture());});
    expect(items.get("m1")?.processingSteps).toBeUndefined();
    await advance(10);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1]?.[0]).toBe("c2");
  });
  it("同scope同消息新逻辑流阻止旧revision响应回写", async () => {
    let resolveFirst: ((value: ReturnType<typeof fixture>) => void) | undefined;
    get.mockImplementationOnce(() => new Promise(resolve => {resolveFirst = resolve;}));
    get.mockResolvedValue(fixture());
    const {result} = setup();
    act(() => {result.current.beginMessage("c1", "m1"); result.current.notifyEnd("c1", "m1");});
    await advance(10);
    act(() => {result.current.beginMessage("c1", "m1");
      items.set("m1", {id: "m1", loaded: true, loading: false, assistant: []});
      result.current.notifyEnd("c1", "m1");});
    await act(async () => {resolveFirst?.(fixture());});
    expect(items.get("m1")?.processingSteps).toBeUndefined();
    await advance(10);
    expect(get).toHaveBeenCalledTimes(2);
    expect(items.get("m1")?.messageStatsPending).toBe(false);
  });

  it("卸载后作废响应且不继续调度", async () => {
    let resolveFirst: ((value: ReturnType<typeof fixture>) => void) | undefined;
    get.mockImplementationOnce(() => new Promise(resolve => {resolveFirst = resolve;}));
    const hook = setup();
    act(() => hook.result.current.notifyEnd("c1", "m1"));
    await advance(10);
    hook.unmount();
    const options = get.mock.calls[0]?.[2] as {signal: AbortSignal};
    expect(options.signal.aborted).toBe(true);
    await act(async () => {resolveFirst?.(fixture());});
    await advance(10000);
    expect(get).toHaveBeenCalledTimes(1);
    expect(items.get("m1")?.processingSteps).toBeUndefined();
  });
});
