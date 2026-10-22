import {AiChatSubAgentCallBriefEventFromJSON} from '@lingya-ai/agents-sdk/browser';
import {AiChatCompressorContextStartBriefEventFromJSON, AiChatMessageBriefEventFromJSON, AiChatThinkBriefEventFromJSON, AiChatAwaitingInputBriefEventFromJSON, AiChatToolExecutionBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
import { describe, expect, it } from "vitest";

import {AiChatEventTypeEnum, TOOL_EXTENSION_CATEGORY, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import type { AssistantChatMessage } from "../hooks/use-chat/types";
import {
  buildUnifiedAssistantTurn,
  isProtectedTool,
  ProcessMemberKind,
  TurnItemKind,
  type UnifiedTurnItem,
} from "./unified-assistant-turn";

function message(sequence: number, text: string) {
  return AiChatMessageBriefEventFromJSON({
    type: AiChatEventTypeEnum.Message,
    sequence,
    message: text,
  });
}
function think(sequence: number, text: string) {
  return AiChatThinkBriefEventFromJSON({
    type: AiChatEventTypeEnum.Think,
    sequence,
    message: text,
  });
}
function tool(
  sequence: number,
  toolId: string,
  status = ToolCallStatusEnum.Success,
  overrides: Record<string, unknown> = {},
) {
  return AiChatToolExecutionBriefEventFromJSON({
    type: AiChatEventTypeEnum.ToolExecution,
    sequence,
    toolId,
    toolName: "read_file",
    status,
    summary: "执行完成",
    ...overrides,
  });
}
function project(events: AssistantChatMessage[], loading = false) {
  return buildUnifiedAssistantTurn(events, loading, () => false);
}
function processItems(items: UnifiedTurnItem[]) {
  return items.filter((item) => item.kind === TurnItemKind.ProcessGroup);
}
function allTools(items: UnifiedTurnItem[]) {
  return processItems(items).flatMap((item) =>
    item.members
      .filter((member) => member.kind === ProcessMemberKind.Tool)
      .map((member) => member.tool),
  );
}

// 投影完全独立于compact/full，仅渲染层决定披露；原始输入必须保持完整。
describe("统一助手轮投影", () => {
  it("过程与普通回复均保留，前端展示模式不改变items或原始事件", () => {
    const events: AssistantChatMessage[] = [
      think(1, "分析"),
      tool(2, "read"),
      message(3, "普通回复"),
    ];
    const original = structuredClone(events);
    const compact = project(events);
    const full = project(events);
    expect(compact.items).toEqual(full.items);
    expect(events).toEqual(original);
    expect(compact.items.map((item) => item.kind)).toEqual([
      TurnItemKind.ProcessGroup,
      TurnItemKind.Reply,
    ]);
    expect(compact.hasOrdinaryProcess).toBe(true);
  });

  it("同一toolId跨回复归并生命周期，最终状态留在首次出现位置", () => {
    const before = project([
      tool(1, "shared", ToolCallStatusEnum.Running),
      message(2, "继续"),
      tool(3, "other"),
    ]);
    const after = project([
      tool(1, "shared", ToolCallStatusEnum.Running),
      message(2, "继续"),
      tool(3, "other"),
      tool(4, "shared", ToolCallStatusEnum.Success),
    ]);
    const tools = allTools(after.items);
    expect(tools.map((item) => item.toolId)).toEqual(["shared", "other"]);
    expect(after.observedToolCalls).toBe(2);
    expect(tools[0]?.derived.state).toBe(ToolCallStatusEnum.Success);
    expect(tools[0]?.events).toHaveLength(2);
    expect(after.items[0]?.key).toBe(before.items[0]?.key);
    expect(tools[0]?.source.sourceIndex).toBe(0);
  });

  it("连续 SDK Think 与 Message 分片合并", () => {
    const result = project([
      think(1, "第"),
      think(3, "一步"),
      message(4, "答"),
      message(6, "案"),
    ]);
    expect(result.items).toHaveLength(2);
    const group = result.items[0];
    if (group?.kind !== TurnItemKind.ProcessGroup)
      throw new Error("缺少过程组");
    expect(group.members).toHaveLength(1);
    const reasoning = group.members[0];
    if (reasoning?.kind !== ProcessMemberKind.Reasoning)
      throw new Error("缺少推理块");
    expect(reasoning.events.map((event) => event.message).join("")).toBe(
      "第一步",
    );
    const reply = result.items[1];
    if (reply?.kind !== TurnItemKind.Reply) throw new Error("缺少回复块");
    expect(reply.events.map((event) => event.message).join("")).toBe("答案");
  });

  it("未知公开事件保留为独立项，内容不被静默丢弃", () => {
    const unknown = {type: 'future-event', rawJson: '{"type":"future-event","payload":1}'};
    const result = project([message(1, '已有回答'), unknown]);
    expect(result.items).toHaveLength(2);
    expect(JSON.stringify(result.items)).toContain('future-event');
  });

  it("后面还有工具时仍保护最后非空文本，纯空白块不能替代最终回复", () => {
    const result = project([
      message(1, "保守保留的答复"),
      tool(2, "last-tool"),
      message(3, "  \n "),
    ]);
    expect(result.lastNonEmptyReplyKey).toBe(result.items[0]?.key);
    const onlyReply = project([message(1, "最终答案")]);
    expect(onlyReply.hasOrdinaryProcess).toBe(false);
  });

  it("Think与工具保持原顺序合成同组，独立可见事件形成明确边界", () => {
    const compression = AiChatCompressorContextStartBriefEventFromJSON({
      type: AiChatEventTypeEnum.CompressorContextStart,
      sequence: 4,
    });
    const result = project([
      think(1, "先分析"),
      tool(2, "read"),
      think(3, "再分析"),
      compression,
      tool(5, "search"),
    ]);
    expect(result.items.map((item) => item.kind)).toEqual([
      TurnItemKind.ProcessGroup,
      TurnItemKind.Standalone,
      TurnItemKind.ProcessGroup,
    ]);
    const firstGroup = result.items[0];
    if (firstGroup?.kind !== TurnItemKind.ProcessGroup)
      throw new Error("缺少过程组");
    expect(firstGroup.members.map((member) => member.kind)).toEqual([
      ProcessMemberKind.Reasoning,
      ProcessMemberKind.Tool,
      ProcessMemberKind.Reasoning,
    ]);
  });

  it("重要回复可由策略标记但不移除其它普通回复", () => {
    const result = buildUnifiedAssistantTurn(
      [message(1, "重要"), tool(2, "read"), message(3, "普通")],
      false,
      (item) => item.events.some((event) => event.message === "重要"),
    );
    const replies = result.items.filter(
      (item) => item.kind === TurnItemKind.Reply,
    );
    expect(replies.map((item) => item.important)).toEqual([true, false]);
  });

  it("等待用户输入与子Agent均用toolCallId归并，不产生重复工具", () => {
    const awaiting = AiChatAwaitingInputBriefEventFromJSON({
      type: AiChatEventTypeEnum.ToolExecutionAwaitingUserInput,
      sequence: 2,
      toolCallId: "ask",
      toolName: "ask_user",
      questionId: "question",
      question: "继续？",
      questionDetails: "确认后继续",
      options: [],
      multiple: false,
      serverNow: "2026-08-03T00:00:00.000Z",
      timeoutSeconds: 60,
    });
    const subAgent = AiChatSubAgentCallBriefEventFromJSON({
      type: AiChatEventTypeEnum.ToolExecutionSubAgentCall,
      sequence: 4,
      toolCallId: "delegate",
      toolName: "delegate_task",
      subAgentConversationId: "sub-conversation",
      subAgentMessageId: "sub-message",
    });
    const tools = allTools(
      project([
        tool(1, "ask", ToolCallStatusEnum.Running),
        awaiting,
        tool(3, "delegate", ToolCallStatusEnum.Running),
        subAgent,
      ]).items,
    );
    expect(tools).toHaveLength(2);
    expect(tools[0]?.attention.awaitingUserInput).toBe(true);
    expect(tools.map(isProtectedTool)).toEqual([true, false]);
  });
});

describe("工具保护规则", () => {
  it.each(Object.values(ToolCallStatusEnum))("%s普通工具与成功结果一样留在折叠组", (status) => {
    const item = allTools(project([tool(1, "failure", status)]).items)[0];
    if (!item) throw new Error("缺少工具");
    expect(isProtectedTool(item)).toBe(false);
  });

  it("专用结果可收纳，待审批交互仍独立展示", () => {
    const tools = allTools(
      project([
        tool(1, "image", ToolCallStatusEnum.Success, {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.IMAGE_GENERATION,
            specialRender: false,
            content: { fileId: 42 },
          },
        }),
        tool(2, "approval", ToolCallStatusEnum.AwaitingApproval, {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
            specialRender: false,
            content: {
              previewFileId: 42,
              serverNow: "2026-08-03T00:00:00.000Z",
              approvalTimeoutAt: "2026-08-03T00:10:00.000Z",
            },
          },
        }),
      ]).items,
    );
    expect(tools[0]?.keyResults).toHaveLength(1);
    expect(tools[1]?.attention.awaitingPlanApproval).toBe(true);
    expect(tools.map(isProtectedTool)).toEqual([false, true]);
  });

  it("specialRender提示不改变工具结果的收纳规则", () => {
    const tools = allTools(
      project([
        tool(1, "special", ToolCallStatusEnum.Success, {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.SQL_QUERY,
            specialRender: true,
            content: { sql: "select 1" },
          },
        }),
        tool(2, "ordinary", ToolCallStatusEnum.Success, {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.SQL_QUERY,
            specialRender: false,
            content: { sql: "select 2" },
          },
        }),
      ]).items,
    );
    if (!tools[0] || !tools[1]) throw new Error("缺少工具");
    expect(isProtectedTool(tools[0])).toBe(false);
    expect(isProtectedTool(tools[1])).toBe(false);
  });

  it("问答完成后用户已选择的结果回归折叠组", () => {
    const awaiting = AiChatAwaitingInputBriefEventFromJSON({
      type: AiChatEventTypeEnum.ToolExecutionAwaitingUserInput,
      sequence: 1,
      toolCallId: "answered",
      toolName: "ask_user",
      questionId: "question",
      question: "继续？",
      questionDetails: "确认后继续",
      options: [{ text: "继续", recommended: true }],
      multiple: false,
      serverNow: "2026-08-03T00:00:00.000Z",
      timeoutSeconds: 60,
    });
    const result = project([
      awaiting,
      tool(2, "answered", ToolCallStatusEnum.Success, {
        extension: {
          category: TOOL_EXTENSION_CATEGORY.ASK_USER_QUESTION,
          specialRender: false,
          content: { selectedOptions: ["继续"] },
        },
      }),
    ]);
    const item = allTools(result.items)[0];
    if (!item) throw new Error("缺少工具");
    expect(item.attention.awaitingUserInput).toBe(false);
    expect(item.derived.askUserSelectedOptions).toEqual(["继续"]);
    expect(isProtectedTool(item)).toBe(false);
  });

  it("已完成的历史审批、数学和脚本结果均可收纳", () => {
    const tools = allTools(
      project([
        tool(1, "legacy-plan", ToolCallStatusEnum.Success, {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
            specialRender: false,
            content: {
              previewFileId: 42,
              serverNow: null,
              approvalTimeoutAt: "2026-08-03T00:10:00.000Z",
            },
          },
        }),
        tool(2, "math", ToolCallStatusEnum.Success, {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.MATH_RESULT,
            specialRender: false,
            content: { result: "2" },
          },
        }),
        tool(3, "js", ToolCallStatusEnum.Success, {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.JS_RUN_SCRIPT_RESULT,
            specialRender: false,
            content: { result: "2", stdout: "计算完成" },
          },
        }),
      ]).items,
    );
    expect(tools).toHaveLength(3);
    expect(tools[0]?.attention.awaitingPlanApproval).toBe(false);
    expect(tools.every(tool => !isProtectedTool(tool))).toBe(true);
  });

  it("历史仅携带问答结果时也按普通结果收纳", () => {
    const result = project([
      tool(1, "history-answer", ToolCallStatusEnum.Success, {
        extension: {
          category: TOOL_EXTENSION_CATEGORY.ASK_USER_QUESTION,
          specialRender: false,
          content: { selectedOptions: ["继续"] },
        },
      }),
    ]);
    const item = allTools(result.items)[0];
    if (!item) throw new Error("缺少工具");
    expect(item.derived.awaitingInput).toBeUndefined();
    expect(item.derived.askUserSelectedOptions).toEqual(["继续"]);
    expect(isProtectedTool(item)).toBe(false);
  });

  it("NoResult不是错误或关键结果，仍属于可收纳的普通过程", () => {
    const result = project([tool(1, "empty", ToolCallStatusEnum.NoResult)]);
    const item = allTools(result.items)[0];
    if (!item) throw new Error("缺少工具");
    expect(isProtectedTool(item)).toBe(false);
    expect(result.hasOrdinaryProcess).toBe(true);
  });
});
