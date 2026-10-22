import {ConversationMessageFromJSON,ToolExtensionFromJSON} from '@lingya-ai/agents-sdk/browser';
import {describe, expect, it} from "vitest";

import {ConversationMessageStatus} from "./conversation-message";
import {buildConversationReplaySource, projectConversationReplay} from "./history-replay";
import {hasSettledMessageStatistics, pickMessageStatistics} from "./message-metadata";
import {AiChatEventTypeEnum, ToolCallStatusEnum, TOOL_EXTENSION_CATEGORY, isKnownToolExtensionInfo} from "./schema";
import type {ChatItem} from "./types";

export function metadataFixture(overrides: Record<string, unknown> = {}) {
  return ConversationMessageFromJSON({
    messageId: "m1", executionType: "USER_MESSAGE", userMessage: {type: "USER", metadata: {}, text: "查询", executionType: "USER_MESSAGE"}, usage: {inputTokens: 0,outputTokens: 0,totalTokens: 0}, inputTokens: 0, outputTokens: 0, totalTokens: 0,
    processingSteps: 3, totalToolCalls: 2, executionTimeMillis: 1200,
    status: ConversationMessageStatus.COMPLETED,
    createdTime: "2026-01-01T00:00:00Z", lastUpdateTime: "2026-01-01T00:00:01Z", ...overrides,
  });
}

const item: ChatItem = {id: "m1", loaded: true, loading: false, assistant: [
  {action: "execute", type: AiChatEventTypeEnum.ToolExecution, toolId: "tool1", toolName: "搜索", status: ToolCallStatusEnum.Success},
]};

describe("扩展公开类型的展示判定", () => {
  it("识别已知扩展并对 SDK 未知扩展安全降级", () => {
    const extension = {category: 'future-preview', rawJson: '{"category":"future-preview","content":{"opaque":true}}'};
    expect(isKnownToolExtensionInfo(extension)).toBe(false);
    const known = ToolExtensionFromJSON({category: TOOL_EXTENSION_CATEGORY.SQL_QUERY, content: {sql: 'select 1'}});
    expect(isKnownToolExtensionInfo(known)).toBe(true);
  });
});

describe("统计元数据", () => {
  it("只映射有效数值，保留合法零值与缺失语义", () => {
    expect(pickMessageStatistics({processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0})).toEqual({
      processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0});
    expect(pickMessageStatistics({processingSteps: -1, totalToolCalls: 0.5, executionTimeMillis: Infinity})).toEqual({});
    expect(pickMessageStatistics({})).toEqual({});
  });
  it("拒绝活动状态、缺失或非法字段，不把活动状态的旧零当作终态统计", () => {
    expect(hasSettledMessageStatistics(metadataFixture({status: ConversationMessageStatus.PENDING,
      processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0}))).toBe(false);
    const zero = {status: ConversationMessageStatus.COMPLETED, processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0};
    expect(hasSettledMessageStatistics({...zero, processingSteps: undefined})).toBe(false);
    expect(hasSettledMessageStatistics({...zero, totalToolCalls: undefined})).toBe(false);
    expect(hasSettledMessageStatistics({...zero, executionTimeMillis: undefined})).toBe(false);
    expect(hasSettledMessageStatistics({...zero, processingSteps: -1})).toBe(false);
    expect(hasSettledMessageStatistics({...zero, totalToolCalls: 0.5})).toBe(false);
    expect(hasSettledMessageStatistics({...zero, executionTimeMillis: Infinity})).toBe(false);
    expect(hasSettledMessageStatistics(zero)).toBe(true);
  });
  it("可见Message、Think和工具事件不否定服务端真实零统计", () => {
    const message = metadataFixture({processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0});
    const events: ChatItem["assistant"] = [...item.assistant,
      {type: AiChatEventTypeEnum.Message, message: "工作流直接输出"},
      {type: AiChatEventTypeEnum.Think, message: "任务说明"}];
    const source = buildConversationReplaySource([message], new Map([[message.messageId, events]]));
    const projected = projectConversationReplay(source)[0];
    expect(projected?.assistant).toHaveLength(3);
    expect(hasSettledMessageStatistics(message)).toBe(true);
    expect(pickMessageStatistics(projected ?? {})).toEqual({processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0});
  });
  it("异步任务直接回复保留合法零步骤和零调用", () => {
    const message = metadataFixture({userMessage: {type: "USER",metadata: {}, text: "",executionType: "ASYNC_TASK_NOTIFICATION"}, executionType: "ASYNC_TASK_NOTIFICATION", processingSteps: 0,
      totalToolCalls: 0, executionTimeMillis: 0});
    const events: ChatItem["assistant"] = [{type: AiChatEventTypeEnum.Message, message: "异步任务直接回复"}];
    const source = buildConversationReplaySource([message], new Map([[message.messageId, events]]));
    expect(hasSettledMessageStatistics(message)).toBe(true);
    expect(projectConversationReplay(source)[0]).toMatchObject({executionType: "ASYNC_TASK_NOTIFICATION",
      processingSteps: 0, totalToolCalls: 0, executionTimeMillis: 0});
  });
  it("回放源和最终ChatItem统计保持一致", () => {
    const source = buildConversationReplaySource([metadataFixture()], new Map());
    expect(pickMessageStatistics(source.messages[0] ?? {})).toEqual({processingSteps: 3, totalToolCalls: 2, executionTimeMillis: 1200});
    expect(pickMessageStatistics(projectConversationReplay(source)[0] ?? {})).toEqual({processingSteps: 3, totalToolCalls: 2, executionTimeMillis: 1200});
  });
});
