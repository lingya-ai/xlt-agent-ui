import {ConversationMessageFromJSON} from '@lingya-ai/agents-sdk/browser';
import { describe, expect, it } from "vitest";

import {ConversationMessageStatus, hasReplayableMessageEvents, isExecutingMessageStatus, isQueuedMessageStatus, isTerminalMessageStatus} from "./conversation-message";

describe("ConversationMessageStatus 分类", () => {
  it("区分排队、执行和取消", () => {
    expect(isQueuedMessageStatus(ConversationMessageStatus.QUEUED)).toBe(true);
    expect(isExecutingMessageStatus(ConversationMessageStatus.PENDING)).toBe(true);
    expect(isTerminalMessageStatus(ConversationMessageStatus.CANCELLED)).toBe(true);
    expect(hasReplayableMessageEvents(ConversationMessageStatus.CANCELLED)).toBe(false);
  });
});


describe("SDK 通知消息元数据", () => {
  it("保留后端明确提供的执行来源和附件，不推断或改写协议字段", () => {
    const wire={messageId:'n',executionType:'ASYNC_TASK_NOTIFICATION',parentMessageId:'p',userMessage:{type:'USER',metadata:{},text:'',executionType:'ASYNC_TASK_NOTIFICATION',attachments:[]},usage:{inputTokens:0,outputTokens:0,totalTokens:0},inputTokens:0,outputTokens:0,totalTokens:0,executionTimeMillis:1,processingSteps:1,totalToolCalls:0,status:'COMPLETED',createdTime:'2026-09-08T09:00:00Z',lastUpdateTime:'2026-09-08T09:00:01Z'};
    const result=ConversationMessageFromJSON(wire);
    expect(result).toMatchObject({executionType:'ASYNC_TASK_NOTIFICATION',parentMessageId:'p',userMessage:wire.userMessage});
    expect(result.createdTime).toBeInstanceOf(Date);
    expect(result.lastUpdateTime).toBeInstanceOf(Date);
  });
});
