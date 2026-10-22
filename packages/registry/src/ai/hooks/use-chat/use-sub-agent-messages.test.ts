// @vitest-environment jsdom
import {act, cleanup, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import {useSubAgentMessages} from "./use-sub-agent-messages";

const mocks = vi.hoisted(() => ({runStream: vi.fn(), abortAllStreams: vi.fn(), updateChatList: vi.fn(),
  flushPendingUpdates: vi.fn(), isResponding: false}));
vi.mock("./use-chat-messages", () => ({useChatMessages: () => ({chatList: [], runStream: mocks.runStream,
  abortAllStreams: mocks.abortAllStreams, updateChatList: mocks.updateChatList,
  flushPendingUpdates: mocks.flushPendingUpdates, isResponding: mocks.isResponding})}));

beforeEach(() => {vi.clearAllMocks(); mocks.isResponding = false; mocks.runStream.mockResolvedValue(undefined);});
afterEach(cleanup);
const httpClient = new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
const info = {toolCallId: "tool1", toolName: "子智能体", conversationId: "c1", messageId: "m1"};

describe("子agent共享终态统计作用域", () => {
  it("切换子调用时作废旧流及其补全，清空旧消息", async () => {
    const hook = renderHook(() => useSubAgentMessages({httpClient}));
    await act(async () => {await hook.result.current.load(info);});
    await act(async () => {await hook.result.current.load({...info, messageId: "m2"});});
    expect(mocks.abortAllStreams).toHaveBeenCalledTimes(2);
    expect(mocks.updateChatList).toHaveBeenCalledWith([]);
    expect(mocks.runStream).toHaveBeenLastCalledWith({conversationId: "c1", messageId: "m2"});
  });
  it("进行中同调用不重复订阅，stop复用共享清理", async () => {
    mocks.isResponding = true;
    const hook = renderHook(() => useSubAgentMessages({httpClient}));
    await act(async () => {await hook.result.current.load(info); await hook.result.current.load(info);});
    expect(mocks.runStream).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.stop());
    expect(mocks.flushPendingUpdates).toHaveBeenCalledTimes(1);
    expect(mocks.abortAllStreams).toHaveBeenCalledTimes(2);
    await act(async () => {await hook.result.current.load(info);});
    expect(mocks.runStream).toHaveBeenCalledTimes(2);
    expect(mocks.abortAllStreams).toHaveBeenCalledTimes(3);
  });
});
