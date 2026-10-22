import {AiChatThinkBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
import { describe, expect, it } from "vitest";

import {AiChatEventTypeEnum, ToolAction, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import {
  getActivityPreview,
  getReasoningActivityPreview,
  getToolActivityDetail,
  ProcessActivityStatus,
  ProcessActivityKind,
  summarizeProcessActivity,
} from "./process-activity-summary";
import type { ToolAttention } from "./tool-presentation-projection";
import {
  ProcessMemberKind,
  type ProcessMember,
} from "./unified-assistant-turn";

function tool(
  toolId: string,
  action: ToolAction,
  state = ToolCallStatusEnum.Success,
  summary?: string,
  attention: Partial<ToolAttention> = {},
): ProcessMember {
  const source = {
    eventType: AiChatEventTypeEnum.ToolExecution,
    eventKey: toolId,
    sourceIndex: 0,
    toolId,
  };
  return {
    kind: ProcessMemberKind.Tool,
    key: toolId,
    source,
    tool: {
      key: toolId,
      toolId,
      toolName: "read_file",
      source,
      events: [],
      keyResults: [],
      derived: { action, state, summary },
      attention: {
        failed: false,
        awaitingUserInput: false,
        awaitingPlanApproval: false,
        ...attention,
      },
    },
  };
}
function reasoning(chunks: string[], isStreaming = false): ProcessMember {
  return {
    kind: ProcessMemberKind.Reasoning,
    key: "reasoning",
    source: {
      eventType: AiChatEventTypeEnum.Think,
      eventKey: "think:1",
      sourceIndex: 0,
    },
    events: chunks.map((message, sequence) =>
      AiChatThinkBriefEventFromJSON({
        type: AiChatEventTypeEnum.Think,
        sequence,
        message,
      }),
    ),
    isStreaming,
  };
}

describe("过程活动摘要", () => {
  it("同一toolId只计数一次，类别保持首次出现顺序", () => {
    const result = summarizeProcessActivity([
      tool("read-1", ToolAction.READ),
      tool("search", ToolAction.SEARCH),
      tool("read-2", ToolAction.READ),
      tool("read-1", ToolAction.READ),
    ]);
    expect(result.observedToolCalls).toBe(3);
    expect(result.categories).toEqual([
      { action: ToolAction.READ, count: 2 },
      { action: ToolAction.SEARCH, count: 1 },
    ]);
    expect(result.status).toBe(ProcessActivityStatus.Settled);
  });

  it("活动动词与detail来自最后仍在运行的工具，完成工具不覆盖活动", () => {
    const result = summarizeProcessActivity([
      tool("search", ToolAction.SEARCH, ToolCallStatusEnum.Running, " 搜索中 "),
      tool("read", ToolAction.READ, ToolCallStatusEnum.Pending, " 读取中 "),
      tool("write", ToolAction.WRITE, ToolCallStatusEnum.Success, "写入完成"),
    ]);
    expect(result.status).toBe(ProcessActivityStatus.Running);
    expect(result.activeAction).toBe(ToolAction.READ);
    expect(result.preparing).toBe(true);
    expect(result.detail).toBe("读取中");
  });

  it("纯推理流显示running，完成后settled，原始长文本不被裁剪", () => {
    const longText = "很长的推理".repeat(100);
    const member = reasoning([longText], true);
    const result = summarizeProcessActivity([member]);
    expect(result.status).toBe(ProcessActivityStatus.Running);
    expect(result.observedToolCalls).toBe(0);
    expect(Array.from(result.reasoningPreview ?? "")).toHaveLength(160);
    if (member.kind !== ProcessMemberKind.Reasoning)
      throw new Error("缺少推理成员");
    expect(member.events[0]?.message).toBe(longText);
    expect(summarizeProcessActivity([reasoning([longText])]).status).toBe(
      ProcessActivityStatus.Settled,
    );
  });

  it.each([
    { awaitingPlanApproval: true },
    { awaitingUserInput: true },
  ])("attention优先于同时存在的running", (attention) => {
    const interactive = tool("attention", ToolAction.INTERACT, ToolCallStatusEnum.AwaitingApproval, undefined, attention);
    if (interactive.kind !== ProcessMemberKind.Tool) throw new Error("缺少工具");
    if ("awaitingPlanApproval" in attention) {
      interactive.tool.derived.planApproval = {
        previewFileId: 42,
        serverNow: new Date("2026-08-03T00:00:00.000Z"),
        approvalTimeoutAt: new Date("2026-08-03T00:10:00.000Z"),
      };
    } else {
      interactive.tool.derived.awaitingInput = {
        questionId: "ask", question: "继续？", questionDetails: "确认后继续", options: [], multiple: false,
        serverNow: new Date("2026-08-03T00:00:00.000Z"), timeoutSeconds: 60,
      };
    }
    const result = summarizeProcessActivity([
      tool("running", ToolAction.READ, ToolCallStatusEnum.Running), interactive,
    ]);
    expect(result.status).toBe(ProcessActivityStatus.Attention);
  });

  it("失败结果不覆盖其他工具的运行提示，也不成为需要关注项", () => {
    const failed = tool("failed", ToolAction.EXECUTE, ToolCallStatusEnum.Error, undefined, { failed: true });
    expect(summarizeProcessActivity([failed]).status).toBe(ProcessActivityStatus.Settled);
    expect(summarizeProcessActivity([failed, tool("running", ToolAction.READ, ToolCallStatusEnum.Running)]).status)
      .toBe(ProcessActivityStatus.Running);
  });

  it("推理chunks先连接后提取预览，空白新推理不抹去已有预览", () => {
    const result = summarizeProcessActivity([
      reasoning(["**完整", "段落**\n\n未完"], true),
      reasoning(["   \n "], true),
    ]);
    expect(result.reasoningPreview).toBe("未完");
    expect(summarizeProcessActivity([])).toEqual({
      activity: { kind: ProcessActivityKind.Idle },
      latestActivity: undefined,
      categories: [],
      observedToolCalls: 0,
      activeAction: undefined,
      preparing: undefined,
      detail: undefined,
      reasoningPreview: undefined,
      preview: undefined,
      status: ProcessActivityStatus.Settled,
    });
  });

  it("最新运行调用按稳定来源选择，生命周期后续更新不挪动调用位置", () => {
    const newer = tool(
      "new",
      ToolAction.SEARCH,
      ToolCallStatusEnum.Running,
      "当前搜索",
    );
    const older = tool(
      "old",
      ToolAction.READ,
      ToolCallStatusEnum.Running,
      "旧调用新状态",
    );
    newer.source.sourceIndex = 20;
    older.source.sourceIndex = 10;
    const result = summarizeProcessActivity([newer, older]);
    expect(result.activeAction).toBe(ToolAction.SEARCH);
    expect(result.detail).toBe("当前搜索");
    expect(result.preparing).toBe(false);
    newer.source.sourceIndex = 5;
    older.source.sourceIndex = 1;
    expect(summarizeProcessActivity([newer, older]).activeAction).toBe(
      ToolAction.SEARCH,
    );
  });

  it("最新工具没有摘要时不沿用旧工具详情，已结束思考不充当实时预览", () => {
    const result = summarizeProcessActivity([
      reasoning(["旧思考"]),
      tool("old", ToolAction.READ, ToolCallStatusEnum.Running, "旧摘要"),
      tool("latest", ToolAction.WRITE, ToolCallStatusEnum.Running),
    ]);
    expect(result.activeAction).toBe(ToolAction.WRITE);
    expect(result.detail).toBeUndefined();
    expect(result.reasoningPreview).toBeUndefined();
  });
});

describe("执行详情的单行预览", () => {
  it("工具业务摘要压缩空白，思考取最后非空段落，原文保持不变", () => {
    expect(getToolActivityDetail("  读取配置\n\t检查字段  ")).toBe(
      "读取配置 检查字段",
    );
    expect(
      getReasoningActivityPreview("旧段\n\n**最新段**\n继续分析\n\n "),
    ).toBe("最新段 继续分析");
    expect(getReasoningActivityPreview(" \n\n ")).toBeUndefined();
    expect(getToolActivityDetail("😀".repeat(161))).toBe(
      `${"😀".repeat(159)}…`,
    );
  });
});

describe("推理预览", () => {
  it("只显示最新非空行，包括当前正在追加的尾行", () => {
    expect(getActivityPreview("第一段\n\n**第二段**\n细节\n\n未完成尾段")).toBe(
      "未完成尾段",
    );
    expect(getActivityPreview("\n  首行\r\n**第二行**\n  ")).toBe("第二行");
    expect(getActivityPreview("  \n\n ")).toBeUndefined();
  });

  it("以Unicode code point截断，避免拆开emoji代理对", () => {
    const preview = getActivityPreview("😀".repeat(130));
    expect(preview).toBe(`${"😀".repeat(120)}…`);
    expect(getActivityPreview("😀".repeat(120))).toBe("😀".repeat(120));
  });
});
