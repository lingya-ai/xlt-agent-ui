import {ConversationReadReceiptFromJSON} from '@lingya-ai/agents-sdk/browser';
import { describe, expect, it, vi } from "vitest";

import {AgentsClient} from "@lingya-ai/agents-sdk/browser";

import {chunkConversationIds, compareExecutionEpoch, conversationActivityReducer, createConversationActivityState, markConversationRead, normalizeConversationIds, requestActiveConversations, requestConversationActivities, requestUnreadConversations, selectConversationActivities, selectConversationActivityPollingIds, shouldAutomaticallyMarkConversationRead, type ConversationActivity, type ConversationActivityState} from "./conversation-activity";

function createActivity(
  overrides: Partial<ConversationActivity> = {},
): ConversationActivity {
  return {
    conversationId: "conversation-1",
    executionStatus: "IDLE",
    activeMessageId: null,
    executionEpoch: "1",
    executionStartedTime: null,
    latestTerminalMessageId: "message-1",
    latestTerminalTime: new Date("2026-09-03T08:00:00Z"),
    hasUnreadCompletion: true,
    requiresUserConfirmation: false,
    ...overrides,
  };
}

function applySnapshot(
  state: ConversationActivityState,
  activity: ConversationActivity,
  operationId: number,
): ConversationActivityState {
  return conversationActivityReducer(state, {
    type: "snapshot-succeeded",
    requestedConversationIds: [activity.conversationId],
    activities: [activity],
    operationId,
  });
}

describe("会话活动 SDK 请求",()=>{
  it("去重、排序并按 1000 个 ID 拆分批次，空列表不请求",async()=>{
    expect(normalizeConversationIds(['b','a','b',' a '])).toEqual(['a','b']);
    const ids=Array.from({length:1001},(_,index)=>'conversation-'+index);
    expect(chunkConversationIds([...ids,' ']).map(chunk=>chunk.length)).toEqual([1000,1]);
    const client=new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    const query=vi.spyOn(client.conversations,'queryConversationActivities').mockResolvedValueOnce({records:[createActivity()]}).mockResolvedValueOnce({records:[createActivity({conversationId:'last'})]});
    expect(await requestConversationActivities(client,[])).toEqual({records:[]});expect(query).not.toHaveBeenCalled();
    const result=await requestConversationActivities(client,ids);
    expect(result.records).toHaveLength(2);expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.map(call=>call[0].conversationIds.length)).toEqual([1000,1]);
    expect(result.records[0]?.executionEpoch).toBe('1');
  });
  it("活动和未读集合规范排序，回执保留精确消息 ID",async()=>{
    const client=new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',auth:{type:'token',tokenProvider:()=> 'one-use'}});
    vi.spyOn(client.conversations,'listActiveConversations').mockResolvedValue({conversationIds:['b','a','b']});
    vi.spyOn(client.conversations,'listUnreadConversations').mockResolvedValue({conversationIds:['b',' a ',' ']});
    const receipt=ConversationReadReceiptFromJSON(createActivity({hasUnreadCompletion:false}));
    const mark=vi.spyOn(client.conversations,'markConversationRead').mockResolvedValue(receipt);
    expect(await requestActiveConversations(client)).toEqual({conversationIds:['a','b']});
    expect(await requestUnreadConversations(client)).toEqual({conversationIds:['a','b']});
    expect(await markConversationRead(client,'conversation/1','message-1')).toBe(receipt);
    expect(mark).toHaveBeenCalledWith('conversation/1',{messageId:'message-1'},{});
  });
});

describe("conversation activity state", () => {
  it("服务端接管新执行后，旧完成回调也不能建立过期待确认任务", () => {
    let state = conversationActivityReducer(createConversationActivityState(), {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "new",
      operationId: 1,
    });
    state = applySnapshot(
      state,
      createActivity({
        executionStatus: "RUNNING",
        activeMessageId: "new",
        executionEpoch: "2",
      }),
      2,
    );
    expect(state.executionOverrideByConversationId.size).toBe(0);
    state = conversationActivityReducer(state, {
      type: "conversation-completed",
      conversationId: "conversation-1",
      messageId: "old",
      operationId: 3,
    });
    expect(state.pendingCompletionByConversationId.size).toBe(0);
    expect(
      selectConversationActivities(state).get("conversation-1")
        ?.activeMessageId,
    ).toBe("new");
  });

  it("窗口未聚焦时不自动确认已读，重新聚焦后才允许确认", () => {
    const activity = createActivity();
    const baseInput = {
      activity,
      activeConversationId: activity.conversationId,
      enabled: true,
      snapshotReady: true,
      readableMessageIds: ["message-1"],
      pageVisible: true,
    };

    expect(
      shouldAutomaticallyMarkConversationRead({
        ...baseInput,
        windowFocused: false,
      }),
    ).toBe(false);
    expect(
      shouldAutomaticallyMarkConversationRead({
        ...baseInput,
        windowFocused: true,
      }),
    ).toBe(true);
    expect(
      shouldAutomaticallyMarkConversationRead({
        ...baseInput,
        activeConversationId: "conversation-2",
        windowFocused: true,
      }),
    ).toBe(false);
    expect(
      shouldAutomaticallyMarkConversationRead({
        ...baseInput,
        activity: createActivity({ latestTerminalMessageId: null }),
        windowFocused: true,
      }),
    ).toBe(false);
  });

  it("发送后立即显示运行态，并由相同消息的服务端快照接管", () => {
    let state = conversationActivityReducer(createConversationActivityState(), {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "message-2",
      operationId: 1,
    });

    expect(
      selectConversationActivities(state).get("conversation-1"),
    ).toMatchObject({
      executionStatus: "RUNNING",
      activeMessageId: "message-2",
    });

    state = applySnapshot(
      state,
      createActivity({
        executionStatus: "RUNNING",
        activeMessageId: "message-2",
        executionEpoch: "2",
      }),
      2,
    );
    expect(state.executionOverrideByConversationId.has("conversation-1")).toBe(
      false,
    );
    expect(
      selectConversationActivities(state).get("conversation-1"),
    ).toMatchObject({
      executionStatus: "RUNNING",
      activeMessageId: "message-2",
    });
  });

  it("只轮询已经确认排队或执行中的会话", () => {
    let state = createConversationActivityState();

    expect(
      selectConversationActivityPollingIds(state, [
        "conversation-idle",
        "conversation-queued",
        "conversation-running",
      ]),
    ).toEqual([]);

    state = conversationActivityReducer(state, {
      type: "snapshot-succeeded",
      requestedConversationIds: [
        "conversation-idle",
        "conversation-queued",
        "conversation-running",
      ],
      activities: [
        createActivity({ conversationId: "conversation-idle" }),
        createActivity({
          conversationId: "conversation-queued",
          executionStatus: "QUEUED",
        }),
        createActivity({
          conversationId: "conversation-running",
          executionStatus: "RUNNING",
        }),
      ],
      operationId: 1,
    });

    expect(
      selectConversationActivityPollingIds(state, [
        "conversation-idle",
        "conversation-queued",
        "conversation-running",
      ]),
    ).toEqual(["conversation-queued", "conversation-running"]);
  });

  it("已空闲的指定会话发起消息后重新加入轮询", () => {
    let state = applySnapshot(
      createConversationActivityState(),
      createActivity({ executionStatus: "IDLE" }),
      1,
    );
    expect(
      selectConversationActivityPollingIds(state, ["conversation-1"]),
    ).toEqual([]);

    state = conversationActivityReducer(state, {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "message-2",
      operationId: 2,
    });

    expect(
      selectConversationActivityPollingIds(state, ["conversation-1"]),
    ).toEqual(["conversation-1"]);
  });

  it("旧完成回调不能清除同一会话的新执行", () => {
    let state = createConversationActivityState();
    state = conversationActivityReducer(state, {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "message-old",
      operationId: 1,
    });
    state = conversationActivityReducer(state, {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "message-new",
      operationId: 2,
    });
    state = conversationActivityReducer(state, {
      type: "conversation-completed",
      conversationId: "conversation-1",
      messageId: "message-old",
      operationId: 3,
    });

    expect(
      selectConversationActivities(state).get("conversation-1"),
    ).toMatchObject({
      executionStatus: "RUNNING",
      activeMessageId: "message-new",
    });
  });

  it("服务端成功查询但遗漏会话时清除本地执行覆盖", () => {
    let state = conversationActivityReducer(createConversationActivityState(), {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "message-1",
      operationId: 2,
    });
    state = conversationActivityReducer(state, {
      type: "snapshot-succeeded",
      requestedConversationIds: ["conversation-1"],
      activities: [],
      operationId: 1,
    });

    expect(selectConversationActivities(state).has("conversation-1")).toBe(
      true,
    );

    state = conversationActivityReducer(state, {
      type: "snapshot-succeeded",
      requestedConversationIds: ["conversation-1"],
      activities: [],
      operationId: 3,
    });

    expect(selectConversationActivities(state).has("conversation-1")).toBe(
      false,
    );
  });

  it("更高 epoch 的服务端终态接管本地旧执行覆盖", () => {
    let state = applySnapshot(
      createConversationActivityState(),
      createActivity({ executionEpoch: "8" }),
      1,
    );
    state = conversationActivityReducer(state, {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "message-local",
      operationId: 2,
    });
    state = applySnapshot(
      state,
      createActivity({
        executionEpoch: "9",
        latestTerminalMessageId: "message-newer",
      }),
      3,
    );

    expect(
      selectConversationActivities(state).get("conversation-1"),
    ).toMatchObject({
      executionStatus: "IDLE",
      latestTerminalMessageId: "message-newer",
    });
  });

  it("权威 IDLE 快照在 epoch 为空时接管本地执行覆盖", () => {
    let state = conversationActivityReducer(createConversationActivityState(), {
      type: "conversation-started",
      conversationId: "conversation-1",
      messageId: "message-local",
      operationId: 1,
    });
    state = applySnapshot(
      state,
      createActivity({
        executionStatus: "IDLE",
        activeMessageId: null,
        executionEpoch: null,
        latestTerminalMessageId: "message-other",
      }),
      2,
    );

    expect(state.executionOverrideByConversationId.has("conversation-1")).toBe(
      false,
    );
    expect(
      selectConversationActivities(state).get("conversation-1"),
    ).toMatchObject({
      executionStatus: "IDLE",
      activeMessageId: null,
      executionEpoch: null,
      latestTerminalMessageId: "message-other",
    });
  });

  it("拒绝晚到操作和较低 epoch 覆盖较新的执行", () => {
    let state = applySnapshot(
      createConversationActivityState(),
      createActivity({
        executionStatus: "RUNNING",
        activeMessageId: "message-new",
        executionEpoch: "10",
      }),
      2,
    );
    state = applySnapshot(
      state,
      createActivity({
        executionStatus: "RUNNING",
        activeMessageId: "message-old",
        executionEpoch: "9",
      }),
      3,
    );
    state = applySnapshot(state, createActivity({ executionEpoch: "11" }), 1);

    expect(compareExecutionEpoch("9223372036854775807", "10")).toBe(1);
    expect(state.serverByConversationId.get("conversation-1")).toMatchObject({
      executionEpoch: "10",
      activeMessageId: "message-new",
    });
  });

  it("只乐观隐藏精确消息，失败后恢复未读", () => {
    let state = applySnapshot(
      createConversationActivityState(),
      createActivity(),
      1,
    );
    state = conversationActivityReducer(state, {
      type: "read-started",
      conversationId: "conversation-1",
      messageId: "message-1",
    });
    expect(
      selectConversationActivities(state).get("conversation-1")
        ?.hasUnreadCompletion,
    ).toBe(false);

    state = conversationActivityReducer(state, {
      type: "read-failed",
      conversationId: "conversation-1",
      messageId: "message-1",
    });
    expect(
      selectConversationActivities(state).get("conversation-1")
        ?.hasUnreadCompletion,
    ).toBe(true);
    expect(
      selectConversationActivityPollingIds(state, ["conversation-1"]),
    ).toEqual([]);
  });

  it("已读成功后抵御旧快照，新终态仍保持未读", () => {
    let state = applySnapshot(
      createConversationActivityState(),
      createActivity(),
      1,
    );
    state = conversationActivityReducer(state, {
      type: "read-started",
      conversationId: "conversation-1",
      messageId: "message-1",
    });
    state = conversationActivityReducer(state, {
      type: "read-succeeded",
      activity: createActivity({ hasUnreadCompletion: false }),
      operationId: 2,
    });
    state = applySnapshot(state, createActivity(), 3);
    expect(
      selectConversationActivities(state).get("conversation-1")
        ?.hasUnreadCompletion,
    ).toBe(false);

    state = applySnapshot(
      state,
      createActivity({
        latestTerminalMessageId: "message-2",
        hasUnreadCompletion: true,
      }),
      4,
    );
    expect(
      selectConversationActivities(state).get("conversation-1")
        ?.hasUnreadCompletion,
    ).toBe(true);
  });

  it("列表收缩和删除会话时清理所有临时状态", () => {
    let state = applySnapshot(
      createConversationActivityState(),
      createActivity(),
      1,
    );
    state = conversationActivityReducer(state, {
      type: "conversation-started",
      conversationId: "conversation-2",
      messageId: "message-2",
      operationId: 2,
    });
    state = conversationActivityReducer(state, {
      type: "retain-conversations",
      conversationIds: ["conversation-2"],
    });
    expect(state.serverByConversationId.size).toBe(0);
    expect(state.executionOverrideByConversationId.size).toBe(1);

    state = conversationActivityReducer(state, {
      type: "remove-conversation",
      conversationId: "conversation-2",
    });
    expect(selectConversationActivities(state).size).toBe(0);
    expect(state.executionOverrideByConversationId.size).toBe(0);
  });
});
