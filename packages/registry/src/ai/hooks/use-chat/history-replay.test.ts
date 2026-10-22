import {UsageFromJSON} from '@lingya-ai/agents-sdk/browser';
import {AiChatEndBriefEventFromJSON, AiChatMessageBriefEventFromJSON, AiChatThinkBriefEventFromJSON, AiChatUserQueryBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
import { describe, expect, it } from "vitest";



import {
  ConversationMessageStatus,
  type ConversationMessageOutput,
} from "./conversation-message";
import {
  applyConversationReplayStep,
  buildConversationReplaySource,
  coalesceReplayTextEvents,
  getConversationReplayDelay,
  orderReplayEvents,
  projectConversationReplay,
  REPLAY_SPEED_OPTIONS,
} from "./history-replay";
import {AiChatEventTypeEnum, type AiChatEvent} from "./schema";

function createMessage(messageId: string): ConversationMessageOutput {
  return {
    messageId,
    executionType: "USER_MESSAGE",
    userMessage: { type: "USER", metadata: {}, text: `问题-${messageId}`, executionType: "USER_MESSAGE" },
    inputTokens: 1,
    outputTokens: 2,
    totalTokens: 3,
    usage: {inputTokens: 1, outputTokens: 2, totalTokens: 3},
    executionTimeMillis: 100,
    processingSteps: 2,
    totalToolCalls: 0,
    status: ConversationMessageStatus.COMPLETED,
    createdTime: new Date("2026-08-01T00:00:00Z"),
    lastUpdateTime: new Date("2026-08-01T00:00:01Z"),
  };
}

function createMessageEvent(sequence: number | undefined, message: string) {
  return AiChatMessageBriefEventFromJSON({
    type: AiChatEventTypeEnum.Message,
    message,
  });
}

function createThinkEvent(sequence: number | undefined, message: string) {
  return AiChatThinkBriefEventFromJSON({
    type: AiChatEventTypeEnum.Think,
    message,
  });
}

function createUserQueryEvent(
  sequence: number | undefined,
  query = "用户问题",
) {
  return AiChatUserQueryBriefEventFromJSON({
    type: AiChatEventTypeEnum.UserQuery,
    query,
  });
}

function createEndEvent(_sequence: number | undefined) {
  return AiChatEndBriefEventFromJSON({
    type: AiChatEventTypeEnum.End,
    executionTimeMillis: 100,
    totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3, inputTokenBreakdown: null },
    artifacts: [],
    nonFileArtifacts: [],
  });
}

describe("coalesceReplayTextEvents", () => {
  it("只合并相邻同类型的小文本分片", () => {
    const events = coalesceReplayTextEvents([
      createMessageEvent(1, "第一"),
      createMessageEvent(2, "段"),
      createThinkEvent(3, "思考"),
      createMessageEvent(4, "第二段"),
    ]);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      type: AiChatEventTypeEnum.Message,
      message: "第一段",
    });
    expect(events[1]).toMatchObject({
      type: AiChatEventTypeEnum.Think,
      message: "思考",
    });
    expect(events[2]).toMatchObject({
      type: AiChatEventTypeEnum.Message,
      message: "第二段",
    });
  });
});

describe("orderReplayEvents", () => {
  it("按 SDK 历史接口的事件顺序回放，不推测排序字段", () => {
    const ordered = orderReplayEvents([
      createMessageEvent(2, "第二段-a"),
      createMessageEvent(1, "第一段"),
      createMessageEvent(2, "第二段-b"),
    ]);

    expect(
      ordered.map((event) =>
        !("rawJson" in event) && event.type === AiChatEventTypeEnum.Message ? event.message : "",
      ),
    ).toEqual(["第二段-a", "第一段", "第二段-b"]);
  });

  it("存在缺失 sequence 时保留接口顺序", () => {
    const events: AiChatEvent[] = [
      createMessageEvent(undefined, "历史第一段"),
      createMessageEvent(1, "历史第二段"),
    ];

    expect(orderReplayEvents(events)).toEqual(events);
  });
});

describe("conversation replay projection", () => {
  it("保留全部事件，并将每个事件拆成逐步回放步骤", () => {
    const message = createMessage("message-1");
    const events: AiChatEvent[] = [
      createUserQueryEvent(1),
      { type: AiChatEventTypeEnum.Start },
      createThinkEvent(3, "分析"),
      createMessageEvent(4, "回答"),
      createEndEvent(5),
    ];

    const source = buildConversationReplaySource(
      [message],
      new Map([[message.messageId, events]]),
    );

    expect(source.messages[0]?.events.map((event) => event.type)).toEqual([
      AiChatEventTypeEnum.UserQuery,
      AiChatEventTypeEnum.Start,
      AiChatEventTypeEnum.Think,
      AiChatEventTypeEnum.Message,
      AiChatEventTypeEnum.End,
    ]);
    expect(source.steps).toHaveLength(6);
  });

  it("历史 End 事件保留事件自身 Usage，不使用 REST Usage 覆盖", () => {
    const restUsage = UsageFromJSON({
      inputTokens: 11371,
      outputTokens: 148,
      totalTokens: 11519,
      inputTokenBreakdown: {
        observedInputTokens: 11371,
        uncachedInputTokens: 107,
        cachedInputTokens: 11264,
        cacheCreationInputTokens: null,
      },
      reasoningTokens: null,
      cacheHitRate: 11264 / 11371,
      inputBreakdownCoverageRate: 1,
    });
    const message = {
      ...createMessage("message-rest-usage"),
      usage: restUsage,
    };
    const source = buildConversationReplaySource(
      [message],
      new Map([[message.messageId, [createEndEvent(1)]]]),
    );
    const endEvent = source.messages[0]?.events[0];

    expect(endEvent).toMatchObject({
      type: AiChatEventTypeEnum.End,
      totalUsage: {
        inputTokens: 1,
        outputTokens: 2,
        totalTokens: 3,
        inputTokenBreakdown: null,
      },
    });
  });

  it("UserQuery 同时更新用户气泡并保留为独立助手事件", () => {
    const message = createMessage("message-user-query");
    const source = buildConversationReplaySource(
      [message],
      new Map([[message.messageId, [createUserQueryEvent(1, "回放中的问题")]]]),
    );
    const messageStep = source.steps[0];
    const eventStep = source.steps[1];

    expect(messageStep).toBeDefined();
    expect(eventStep).toBeDefined();
    if (!messageStep || !eventStep) return;

    const afterMessage = applyConversationReplayStep([], source, messageStep);
    const afterEvent = applyConversationReplayStep(
      afterMessage,
      source,
      eventStep,
    );

    expect(afterEvent[0]?.user?.text).toBe("回放中的问题");
    expect(afterEvent[0]?.assistant).toMatchObject([
      { type: AiChatEventTypeEnum.UserQuery, query: "回放中的问题" },
    ]);
  });

  it("逐步消费时复用实时聊天的 Message 与 Think 合并语义", () => {
    const message = createMessage("message-1");
    const source = buildConversationReplaySource(
      [message],
      new Map([
        [
          message.messageId,
          [
            createThinkEvent(1, "先"),
            createThinkEvent(2, "思考"),
            createMessageEvent(3, "再"),
            createMessageEvent(4, "回答"),
            createEndEvent(5),
          ],
        ],
      ]),
    );

    const completed = projectConversationReplay(source);
    const assistant = completed[0]?.assistant ?? [];

    expect(assistant).toHaveLength(3);
    expect(assistant[0]).toMatchObject({
      type: AiChatEventTypeEnum.Think,
      message: "先思考",
    });
    expect(assistant[1]).toMatchObject({
      type: AiChatEventTypeEnum.Message,
      message: "再回答",
    });
    expect(completed[0]).toMatchObject({
      loading: false,
      status: ConversationMessageStatus.COMPLETED,
    });
  });

  it("未消费终态事件前保持消息进行中", () => {
    const message = createMessage("message-1");
    const source = buildConversationReplaySource(
      [message],
      new Map([
        [message.messageId, [createMessageEvent(1, "回答"), createEndEvent(2)]],
      ]),
    );
    const messageStep = source.steps[0];
    const firstEventStep = source.steps[1];

    expect(messageStep).toBeDefined();
    expect(firstEventStep).toBeDefined();
    if (!messageStep || !firstEventStep) return;

    const afterMessage = applyConversationReplayStep([], source, messageStep);
    const afterFirstEvent = applyConversationReplayStep(
      afterMessage,
      source,
      firstEventStep,
    );

    expect(afterFirstEvent[0]).toMatchObject({
      loading: true,
      status: ConversationMessageStatus.PENDING,
    });
  });
});

describe("conversation replay speed", () => {
  it("将原 2× 速度映射为新的 1×", () => {
    const message = createMessage("message-speed");
    const source = buildConversationReplaySource(
      [message],
      new Map([[message.messageId, [createMessageEvent(1, "回答")]]]),
    );
    const messageStep = source.steps[0];
    const eventStep = source.steps[1];

    expect(REPLAY_SPEED_OPTIONS).toEqual([0.25, 0.5, 0.75, 1]);
    expect(messageStep).toBeDefined();
    expect(eventStep).toBeDefined();
    if (!messageStep || !eventStep) return;

    expect(getConversationReplayDelay(source, messageStep, 1)).toBe(210);
    expect(getConversationReplayDelay(source, messageStep, 0.5)).toBe(420);
    expect(getConversationReplayDelay(source, eventStep, 1)).toBe(40);
    expect(getConversationReplayDelay(source, eventStep, 0.5)).toBe(80);
  });
});


describe("独立通知历史回放", () => {
  it.each(["ASYNC_TASK_NOTIFICATION", "GOAL_CONTINUATION"])("旧事件重建后仍保留 %s 类型和父消息", executionType => {
    const message: ConversationMessageOutput = {...createMessage("notification"), userMessage: {type: "USER", metadata: {}, text: "", executionType}, executionType: "USER_MESSAGE", parentMessageId: "original"};
    const source = buildConversationReplaySource([message], new Map([[message.messageId, [createUserQueryEvent(0, "不可公开的系统指令"), createMessageEvent(1, "后续回复"), createEndEvent(2)]]]));
    expect(projectConversationReplay(source)[0]).toMatchObject({executionType, parentMessageId: "original", user: {text: ""}});
    expect(JSON.stringify(projectConversationReplay(source))).not.toContain("不可公开的系统指令");
  });
});
