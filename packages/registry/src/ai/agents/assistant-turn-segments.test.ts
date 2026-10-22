import {AiChatCompressorContextStartBriefEventFromJSON, AiChatErrorBriefEventFromJSON, AiChatMessageBriefEventFromJSON, AiChatThinkBriefEventFromJSON, AiChatAwaitingInputBriefEventFromJSON, AiChatToolExecutionBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
import { describe, expect, it } from "vitest";
import {AiChatEventTypeEnum, TOOL_EXTENSION_CATEGORY, ToolAction, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import type { AssistantChatMessage } from "../hooks/use-chat/types";
import { buildAssistantTurnProjection } from "./message-disclosure-policy";
import {
  AssistantTurnSegmentKind,
  buildAssistantTurnSegments,
} from "./assistant-turn-segments";
import { ProcessMemberKind, TurnItemKind } from "./unified-assistant-turn";
import { ProcessActivityKind } from "./process-activity-summary";

function reply(sequence: number, message: string) {
  return AiChatMessageBriefEventFromJSON({
    type: AiChatEventTypeEnum.Message,
    sequence,
    message,
  });
}
function tool(
  sequence: number,
  toolId: string,
  overrides: Record<string, unknown> = {},
) {
  return AiChatToolExecutionBriefEventFromJSON({
    type: AiChatEventTypeEnum.ToolExecution,
    sequence,
    toolId,
    toolName: "read",
    action: ToolAction.READ,
    status: ToolCallStatusEnum.Success,
    summary: null,
    ...overrides,
  });
}
const compactOptions = {
  mode: "compact" as const,
  executing: false,
};
function segment(events: AssistantChatMessage[], options: Parameters<typeof buildAssistantTurnSegments>[1] = compactOptions) {
  return buildAssistantTurnSegments(
    buildAssistantTurnProjection(events, false),
    options,
  );
}
function groups(segments: ReturnType<typeof segment>) {
  return segments.filter(
    (item) => item.kind === AssistantTurnSegmentKind.ProcessGroup,
  );
}
function toolIds(segments: ReturnType<typeof segment>) {
  return segments.flatMap((item) =>
    item.kind === AssistantTurnSegmentKind.ProtectedTool ||
    item.kind === AssistantTurnSegmentKind.SpecialRenderTool
      ? [item.member.tool.toolId]
      : item.kind === AssistantTurnSegmentKind.ProcessMember
        ? item.member.kind === ProcessMemberKind.Tool
          ? [item.member.tool.toolId]
          : []
        : item.kind === AssistantTurnSegmentKind.ProcessGroup
          ? item.members.flatMap((member) =>
              member.kind === ProcessMemberKind.Tool
                ? [member.tool.toolId]
                : [],
            )
          : [],
  );
}

describe("重点模式跨阶段展示分段", () => {
  it.each(["compact", "full"] as const)("%s末尾工具完成仍保留活动资格，独立正文、中断和结束立即收尾", (mode) => {
    const events = [tool(1, "a", { status: ToolCallStatusEnum.Running, summary: "读取数据" }), tool(2, "a", { summary: "完成结果" })];
    const project = (input: AssistantChatMessage[], executing = true, messageInterrupted = false) => buildAssistantTurnSegments(
      buildAssistantTurnProjection(input, executing), { mode, executing, messageInterrupted },
    );
    const waiting = groups(project(events))[0];
    expect(waiting?.isActive).toBe(true);
    expect(waiting?.summary.activity?.kind).toBe(ProcessActivityKind.Idle);
    expect(waiting?.summary.latestActivity?.detail).toBe("读取数据");
    const boundary = mode === "compact" ? "**重要提示** 下一阶段" : "下一阶段";
    expect(groups(project([...events, reply(3, boundary)]))[0]?.isActive).toBe(false);
    expect(groups(project(events, true, true))[0]?.isActive).toBe(false);
    expect(groups(project(events, false))[0]?.isActive).toBe(false);
    expect(groups(project([...events, AiChatErrorBriefEventFromJSON({ type: AiChatEventTypeEnum.Error, sequence: 3, message: "执行失败" })]))[0]?.isActive).toBe(false);
  });

  it("完整模式连续工具合组，流式追加保持身份且不修改原始投影", () => {
    const events = [tool(1, "a"), tool(2, "b"), tool(3, "c")];
    let key: string | undefined;
    for (let length = 1; length <= events.length; length += 1) {
      const projection = buildAssistantTurnProjection(
        events.slice(0, length),
        true,
      );
      const original = structuredClone(projection);
      const result = buildAssistantTurnSegments(projection, {
        mode: "full",
        executing: true,
      });
      expect(groups(result)).toHaveLength(1);
      key ??= groups(result)[0]?.key;
      expect(groups(result)[0]?.key).toBe(key);
      expect(toolIds(result)).toEqual(["a", "b", "c"].slice(0, length));
      expect(projection).toEqual(original);
    }
  });

  it.each([false, true])(
    "完整模式审批和专用结果切开工具组，中断=%s",
    (messageInterrupted) => {
      const events = [
        tool(1, "a"),
        tool(2, "b"),
        tool(3, "approval", {
          status: ToolCallStatusEnum.AwaitingApproval,
          extension: {
            category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
            content: {
              previewFileId: 42,
              serverNow: "2026-08-03T00:00:00.000Z",
              approvalTimeoutAt: "2026-08-03T00:10:00.000Z",
            },
          },
        }),
        tool(4, "c"),
        tool(5, "special", {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.SQL_QUERY,
            specialRender: true,
            content: { sql: "select 1" },
          },
        }),
        tool(6, "d"),
      ];
      const result = buildAssistantTurnSegments(
        buildAssistantTurnProjection(events, false),
        {
          mode: "full",
          executing: false,
          messageInterrupted,
        },
      );
      expect(result.map((item) => item.kind)).toEqual([
        AssistantTurnSegmentKind.ProcessGroup,
        messageInterrupted
          ? AssistantTurnSegmentKind.ProcessMember
          : AssistantTurnSegmentKind.ProtectedTool,
        AssistantTurnSegmentKind.ProcessGroup,
        AssistantTurnSegmentKind.ProcessMember,
        AssistantTurnSegmentKind.ProcessGroup,
      ]);
      expect(groups(result).map((item) => item.members.length)).toEqual([
        2, 1, 1,
      ]);
      expect(toolIds(result)).toEqual([
        "a",
        "b",
        "approval",
        "c",
        "special",
        "d",
      ]);
    },
  );

  it("specialRender工具切开过程折叠组并独立展示，中断消息仍保留该边界", () => {
    const events = [
      tool(1, "before", {
        extension: {
          category: TOOL_EXTENSION_CATEGORY.SQL_QUERY,
          specialRender: false,
          content: { sql: "select 0" },
        },
      }),
      tool(2, "highlighted", {
        extension: {
          category: TOOL_EXTENSION_CATEGORY.SQL_QUERY,
          specialRender: true,
          content: { sql: "select 1" },
        },
      }),
      tool(3, "after"),
      reply(4, "最终回复"),
    ];

    const result = segment(events);
    expect(result.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.SpecialRenderTool,
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.Reply,
    ]);
    expect(toolIds(result)).toEqual(["before", "highlighted", "after"]);

    const interrupted = segment(events, {
      ...compactOptions,
      messageInterrupted: true,
    });
    expect(interrupted[1]?.kind).toBe(
      AssistantTurnSegmentKind.SpecialRenderTool,
    );
  });

  it("相邻specialRender工具各自显示，不产生空折叠组", () => {
    const result = segment([
      tool(1, "first", {
        extension: {
          category: TOOL_EXTENSION_CATEGORY.SQL_QUERY,
          specialRender: true,
          content: { sql: "select 1" },
        },
      }),
      tool(2, "second", {
        extension: {
          category: TOOL_EXTENSION_CATEGORY.SQL_QUERY,
          specialRender: true,
          content: { sql: "select 2" },
        },
      }),
      tool(3, "ordinary"),
    ]);

    expect(result.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.SpecialRenderTool,
      AssistantTurnSegmentKind.SpecialRenderTool,
      AssistantTurnSegmentKind.ProcessGroup,
    ]);
    expect(groups(result)).toHaveLength(1);
  });

  it("逐事件推进时普通阶段文字只更新预览，组数量和身份保持稳定，结束后保护末条回复", () => {
    const events = [
      tool(1, "a", { status: ToolCallStatusEnum.Running }),
      tool(2, "a"),
      reply(3, "第一阶段\n开始下一步"),
      tool(4, "b", { status: ToolCallStatusEnum.Running }),
      tool(5, "b"),
      reply(6, "第二阶段"),
      tool(7, "c"),
      reply(8, "最终回复"),
    ];
    let key: string | undefined;
    for (let length = 1; length <= events.length; length += 1) {
      const result = buildAssistantTurnSegments(
        buildAssistantTurnProjection(events.slice(0, length), true),
        { mode: "compact", executing: true },
      );
      expect(result.map((item) => item.kind)).toEqual([
        AssistantTurnSegmentKind.ProcessGroup,
      ]);
      key ??= result[0]?.key;
      expect(result[0]?.key).toBe(key);
      expect(groups(result)[0]?.isActive).toBe(true);
      expect(new Set(toolIds(result)).size).toBe(toolIds(result).length);
      if (length === 3)
        expect(groups(result)[0]?.summary.preview).toBe("开始下一步");
    }
    const completed = segment(events);
    expect(completed.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.Reply,
    ]);
    expect(completed[0]?.key).toBe(key);
    expect(groups(completed)[0]?.isActive).toBe(false);
    expect(toolIds(completed)).toEqual(["a", "b", "c"]);
  });

  it("执行中仍保留重要回复，失败工具不拆组，全部模式保留原始阶段", () => {
    const events = [
      tool(1, "a"),
      reply(2, "**重要提示**"),
      tool(3, "b"),
      reply(4, "普通阶段"),
      tool(5, "failed", { status: ToolCallStatusEnum.Error }),
      tool(6, "c"),
      reply(7, "当前阶段"),
    ];
    const projection = buildAssistantTurnProjection(events, true);
    const compact = buildAssistantTurnSegments(projection, {
      mode: "compact",
      executing: true,
    });
    expect(compact.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.Reply,
      AssistantTurnSegmentKind.ProcessGroup,
    ]);
    expect(groups(compact).map((item) => item.isActive)).toEqual([false, true]);
    const full = buildAssistantTurnSegments(projection, {
      mode: "full",
      executing: true,
    });
    expect(
      full.filter((item) => item.kind === AssistantTurnSegmentKind.Reply),
    ).toHaveLength(3);
    expect(toolIds(full)).toEqual(toolIds(compact));
  });

  it("初始普通助手文字建立折叠组但只保留预览，后续工具及切档沿用来源，结束后纯文字回复展开", () => {
    const initial = reply(1, "先查看\n工作区文件");
    const result = buildAssistantTurnSegments(
      buildAssistantTurnProjection([initial], true),
      { mode: "compact", executing: true },
    );
    expect(result.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.ProcessGroup,
    ]);
    const group = groups(result)[0];
    // 重点模式不把助手文字放进组内，只保留组头预览。
    expect(group?.members).toEqual([]);
    // 组内没有工具成员时不提供展开入口。
    expect(group?.expandable).toBe(false);
    expect(group?.summary.preview).toBe("工作区文件");
    expect(group?.summary.observedToolCalls).toBe(0);
    const projection = buildAssistantTurnProjection(
      [initial, tool(2, "a")],
      true,
    );
    const compact = buildAssistantTurnSegments(projection, {
      mode: "compact",
      executing: true,
    });
    const full = buildAssistantTurnSegments(projection, {
      mode: "full",
      executing: true,
    });
    expect(groups(compact)[0]?.key).toBe(group?.key);
    expect(groups(full)).toHaveLength(1);
    expect(
      full.some(
        (item) =>
          item.kind === AssistantTurnSegmentKind.ProcessGroup &&
          item.members.some((member) => member.kind === ProcessMemberKind.Tool),
      ),
    ).toBe(true);
    expect(toolIds(compact)).toEqual(["a"]);
    expect(segment([initial]).map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.Reply,
    ]);
  });

  it("跨隐藏阶段文字合并推理与工具，重点模式组内只保留工具", () => {
    const projection = buildAssistantTurnProjection(
      [
        tool(1, "a"),
        reply(2, "普通阶段"),
        AiChatThinkBriefEventFromJSON({
          type: AiChatEventTypeEnum.Think,
          sequence: 3,
          message: "继续思考",
        }),
        tool(4, "b", { action: ToolAction.EXECUTE }),
        reply(5, "最终回复"),
      ],
      false,
    );
    const original = structuredClone(projection.items);
    const merged = buildAssistantTurnSegments(projection, compactOptions);
    expect(groups(merged)).toHaveLength(1);
    expect(toolIds(merged)).toEqual(["a", "b"]);
    // 重点模式只收纳工具，推理不进入组内渲染。
    expect(groups(merged)[0]?.members.map((member) => member.kind)).toEqual([
      ProcessMemberKind.Tool,
      ProcessMemberKind.Tool,
    ]);
    // 有工具成员时才提供展开入口。
    expect(groups(merged)[0]?.expandable).toBe(true);
    expect(groups(merged)[0]?.summary.categories).toEqual([
      { action: ToolAction.READ, count: 1 },
      { action: ToolAction.EXECUTE, count: 1 },
    ]);
    expect(projection.items).toEqual(original);
    expect(groups(merged)[0]?.members[0]).toBe(
      projection.items[0]?.kind === TurnItemKind.ProcessGroup
        ? projection.items[0].members[0]
        : undefined,
    );
    // 完整模式保留顺序，思考切开左右工具组。
    const full = buildAssistantTurnSegments(projection, {
      mode: "full",
      executing: false,
    });
    expect(
      full
        .filter((item) => item.kind === AssistantTurnSegmentKind.ProcessMember)
        .map((item) => item.member.kind),
    ).toEqual([ProcessMemberKind.Reasoning]);
    expect(groups(full)).toHaveLength(2);
    expect(toolIds(full)).toEqual(["a", "b"]);
  });

  it("完整模式保留正文并切开左右工具组", () => {
    const projection = buildAssistantTurnProjection(
      [tool(1, "a"), reply(2, "阶段"), tool(3, "b"), reply(4, "最终")],
      false,
    );
    const merged = buildAssistantTurnSegments(projection, compactOptions);
    const full = buildAssistantTurnSegments(projection, {
      mode: "full",
      executing: false,
    });
    expect(groups(merged)).toHaveLength(1);
    expect(groups(full)).toHaveLength(2);
    expect(full.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.Reply,
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.Reply,
    ]);
    expect(toolIds(full)).toEqual(["a", "b"]);
    expect(buildAssistantTurnSegments(projection, compactOptions)).toEqual(
      merged,
    );
  });

  it("重要回复和末条非空回复均打断合并，包括末条之后仍有工具", () => {
    const result = segment([
      tool(1, "a"),
      reply(2, "**重要提示** 内容"),
      tool(3, "b"),
      reply(4, "末条回复"),
      tool(5, "c"),
      reply(6, "  "),
    ]);
    expect(groups(result)).toHaveLength(3);
    expect(
      result
        .filter((item) => item.kind === AssistantTurnSegmentKind.Reply)
        .map((item) =>
          item.reply.events.map((event) => event.message).join(""),
        ),
    ).toEqual(["**重要提示** 内容", "末条回复"]);
  });

  it.each([
    { status: ToolCallStatusEnum.Error },
    {
      extension: {
        category: TOOL_EXTENSION_CATEGORY.MATH_RESULT,
        specialRender: false,
        content: { result: "42" },
      },
    },
    {
      status: ToolCallStatusEnum.AwaitingApproval,
      extension: {
        category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
        specialRender: false,
        content: {
          previewFileId: 42,
          serverNow: "2026-08-03T00:00:00.000Z",
          approvalTimeoutAt: "2026-08-03T00:10:00.000Z",
        },
      },
    },
    {
      extension: {
        category: "future-preview",
        specialRender: true,
        content: { private: "不公开" },
      },
    },
  ])(
    "待审批或specialRender工具打断左右普通段，其他结果统一收纳：%j",
    (overrides) => {
      const result = segment([
        tool(1, "a"),
        reply(2, "阶段一"),
        tool(3, "protected", overrides),
        reply(4, "阶段二"),
        tool(5, "b"),
        reply(6, "最终"),
      ]);
      const isSpecialRender =
        "extension" in overrides && overrides.extension?.specialRender === true;
      const isAwaitingApproval =
        "status" in overrides &&
        overrides.status === ToolCallStatusEnum.AwaitingApproval;
      expect(result.map((item) => item.kind)).toEqual([
        AssistantTurnSegmentKind.ProcessGroup,
        ...(isSpecialRender
          ? [
              AssistantTurnSegmentKind.SpecialRenderTool,
              AssistantTurnSegmentKind.ProcessGroup,
            ]
          : isAwaitingApproval
            ? [
                AssistantTurnSegmentKind.ProtectedTool,
                AssistantTurnSegmentKind.ProcessGroup,
              ]
            : []),
        AssistantTurnSegmentKind.Reply,
      ]);
      expect(toolIds(result)).toEqual(["a", "protected", "b"]);
    },
  );

  it("等待用户问答打断合并且只占据一次原始位置", () => {
    const awaiting = AiChatAwaitingInputBriefEventFromJSON({
      type: AiChatEventTypeEnum.ToolExecutionAwaitingUserInput,
      sequence: 3,
      toolCallId: "ask",
      toolName: "ask_user",
      questionId: "question",
      question: "继续？",
      options: [],
      multiple: false,
      serverNow: "2026-08-03T00:00:00.000Z",
      timeoutSeconds: 60,
    });
    const result = segment([
      tool(1, "a"),
      reply(2, "第一阶段"),
      awaiting,
      reply(4, "第二阶段"),
      tool(5, "b"),
      reply(6, "最终"),
    ]);
    expect(result.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.ProtectedTool,
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.Reply,
    ]);
    expect(toolIds(result)).toEqual(["a", "ask", "b"]);
  });

  it("压缩和错误独立事件形成边界，空白文本不形成边界", () => {
    const result = segment([
      tool(1, "a"),
      reply(2, "  "),
      tool(3, "b"),
      AiChatCompressorContextStartBriefEventFromJSON({
        type: AiChatEventTypeEnum.CompressorContextStart,
        sequence: 4,
      }),
      tool(5, "c"),
      AiChatErrorBriefEventFromJSON({
        type: AiChatEventTypeEnum.Error,
        sequence: 6,
        message: "错误",
      }),
      tool(7, "d"),
      reply(8, "最后"),
    ]);
    expect(groups(result)).toHaveLength(3);
    expect(groups(result)[0]?.summary.observedToolCalls).toBe(2);
    expect(
      result.filter(
        (item) => item.kind === AssistantTurnSegmentKind.Standalone,
      ),
    ).toHaveLength(2);
  });

  it("流式追加与生命周期更新保持组key及唯一调用，失败后仍在原组收纳", () => {
    const initial = [
      tool(1, "a", { status: ToolCallStatusEnum.Running }),
      reply(2, "阶段"),
      tool(3, "b"),
    ];
    const before = segment(initial);
    const after = segment([
      ...initial,
      reply(4, "后续阶段"),
      tool(5, "c"),
      tool(6, "a", { status: ToolCallStatusEnum.Success }),
      reply(7, "最终"),
    ]);
    expect(groups(after)[0]?.key).toBe(groups(before)[0]?.key);
    expect(toolIds(after)).toEqual(["a", "b", "c"]);
    expect(groups(after)[0]?.summary.observedToolCalls).toBe(3);
    const failed = segment([
      ...initial,
      tool(4, "a", { status: ToolCallStatusEnum.Error }),
      reply(5, "最终"),
    ]);
    expect(failed[0]?.kind).toBe(AssistantTurnSegmentKind.ProcessGroup);
    expect(groups(failed)[0]?.key).toBe(groups(before)[0]?.key);
    expect(toolIds(failed)).toEqual(["a", "b"]);
  });

  it("流式补充专用结果仍保留原组，组身份及调用数不变", () => {
    const initial = [
      tool(1, "a"),
      tool(2, "result", { status: ToolCallStatusEnum.Running }),
      reply(3, "阶段"),
      tool(4, "b"),
      reply(5, "最终"),
    ];
    const before = segment(initial);
    expect(groups(before)).toHaveLength(1);
    const projection = buildAssistantTurnProjection(
      [
        ...initial,
        tool(6, "result", {
          extension: {
            category: TOOL_EXTENSION_CATEGORY.MATH_RESULT,
            specialRender: false,
            content: { result: "42" },
          },
        }),
      ],
      false,
    );
    const after = buildAssistantTurnSegments(projection, compactOptions);
    expect(groups(after)).toHaveLength(1);
    expect(groups(after)[0]?.key).toBe(groups(before)[0]?.key);
    expect(toolIds(after)).toEqual(["a", "result", "b"]);
    expect(
      after.filter(
        (item) => item.kind === AssistantTurnSegmentKind.ProtectedTool,
      ),
    ).toHaveLength(0);
    expect(projection.observedToolCalls).toBe(3);
  });

  it("重点模式将失败工具与成功工具合并收纳，阶段回复隐藏", () => {
    const result = segment([
      tool(1, "a"),
      reply(2, "普通阶段"),
      tool(3, "failed", { status: ToolCallStatusEnum.Error }),
      tool(4, "b"),
      reply(5, "最后"),
    ]);
    expect(result.map((item) => item.kind)).toEqual([
      AssistantTurnSegmentKind.ProcessGroup,
      AssistantTurnSegmentKind.Reply,
    ]);
  });

  it("折叠标题保留最新助手行，运行业务摘要压成一行且完成后不残留", () => {
    const initial = [
      tool(1, "running", {
        status: ToolCallStatusEnum.Running,
        summary: "读取数据\n当前正在校验",
      }),
      reply(2, "助手旧行\n助手最新行\n "),
    ];
    const running = groups(segment(initial))[0]?.summary;
    expect(running?.detail).toBe("读取数据 当前正在校验");
    expect(running?.preview).toBe("助手最新行");
    const completed = groups(
      segment([
        ...initial,
        tool(3, "running", { status: ToolCallStatusEnum.Success }),
      ]),
    )[0]?.summary;
    expect(completed?.detail).toBeUndefined();
    expect(completed?.preview).toBe("助手最新行");
    const full = buildAssistantTurnSegments(
      buildAssistantTurnProjection(initial, true),
      {
        mode: "full",
        executing: true,
      },
    );
    expect(groups(full)).toHaveLength(1);
  });

  it("工具无运行摘要时不借用旧思考，也不跨越保护项借用文本", () => {
    const result = segment([
      AiChatThinkBriefEventFromJSON({
        type: AiChatEventTypeEnum.Think,
        sequence: 1,
        message: "旧思考\n最新思考",
      }),
      tool(2, "running", { status: ToolCallStatusEnum.Running }),
      tool(3, "protected", {
        status: ToolCallStatusEnum.AwaitingApproval,
        extension: {
          category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
          content: {
            previewFileId: 42,
            serverNow: "2026-08-03T00:00:00.000Z",
            approvalTimeoutAt: "2026-08-03T00:10:00.000Z",
          },
        },
      }),
      reply(4, "保护项之后的回复"),
    ]);
    expect(groups(result)[0]?.summary.detail).toBeUndefined();
    expect(groups(result)[0]?.summary.preview).toBeUndefined();
    expect(groups(result)[0]?.isActive).toBe(false);
  });

  it("只有最新运行段展示动态标题，结束事件后不会让旧运行态继续激活标题", () => {
    const initial = [
      tool(1, "running", { status: ToolCallStatusEnum.Running }),
    ];
    const running = buildAssistantTurnSegments(
      buildAssistantTurnProjection(initial, true),
      { mode: "compact", executing: true },
    );
    expect(groups(running)[0]?.isActive).toBe(true);
    const ended = segment([
      ...initial,
      AiChatErrorBriefEventFromJSON({
        type: AiChatEventTypeEnum.Error,
        sequence: 2,
        message: "轮级错误",
      }),
    ]);
    expect(groups(ended)[0]?.isActive).toBe(false);
  });
});
