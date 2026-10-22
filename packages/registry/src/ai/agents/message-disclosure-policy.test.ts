import {AiChatCompressorContextEndBriefEventFromJSON, AiChatCompressorContextStartBriefEventFromJSON, AiChatMessageBriefEventFromJSON, AiChatStartBriefEventFromJSON, AiChatThinkBriefEventFromJSON, AiChatToolExecutionBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
import { describe, expect, it } from "vitest";
import {AiChatEventTypeEnum, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import {
  buildAssistantTurnProjection,
  deriveAssistantWorkingState,
  isImportantAssistantMessage,
  isMessageViewSwitchEnabled,
  type AssistantMessageRenderItem,
} from "./message-disclosure-policy";
import { ProcessMemberKind, TurnItemKind } from "./unified-assistant-turn";

function createMessage(sequence: number, message: string) {
  return AiChatMessageBriefEventFromJSON({
    type: AiChatEventTypeEnum.Message,
    sequence,
    message,
  });
}
function createThink(sequence: number, message = "分析中") {
  return AiChatThinkBriefEventFromJSON({
    type: AiChatEventTypeEnum.Think,
    sequence,
    message,
  });
}
function createToolEvent(
  sequence: number | undefined,
  overrides: Record<string, unknown> = {},
) {
  return AiChatToolExecutionBriefEventFromJSON({
    type: AiChatEventTypeEnum.ToolExecution,
    toolId: "tool-1",
    toolName: "read",
    status: ToolCallStatusEnum.Success,
    sequence,
    summary: null,
    ...overrides,
  });
}
function createStart(sequence: number) {
  return AiChatStartBriefEventFromJSON({
    type: AiChatEventTypeEnum.Start,
    sequence,
  });
}
function createCompressionStart(sequence: number) {
  return AiChatCompressorContextStartBriefEventFromJSON({
    type: AiChatEventTypeEnum.CompressorContextStart,
    sequence,
  });
}
function createCompressionEnd(sequence: number) {
  return AiChatCompressorContextEndBriefEventFromJSON({
    type: AiChatEventTypeEnum.CompressorContextEnd,
    sequence,
  });
}
function getMessageRenderItem(message: string): AssistantMessageRenderItem {
  const event = createMessage(1, message);
  return {
    key: "message:1",
    events: [event],
    isStreaming: false,
    source: {
      eventType: AiChatEventTypeEnum.Message,
      eventKey: "1",
      sourceIndex: 0,
    },
  };
}

describe("消息展示模式开关", () => {
  it("默认关闭，可由非受控实例启用，受控实例需要切换回调", () => {
    expect(isMessageViewSwitchEnabled()).toBe(false);
    expect(isMessageViewSwitchEnabled(undefined, true)).toBe(true);
    expect(
      isMessageViewSwitchEnabled({ switchable: true, defaultMode: "full" }),
    ).toBe(true);
    expect(isMessageViewSwitchEnabled({ mode: "full", switchable: true })).toBe(
      false,
    );
    expect(
      isMessageViewSwitchEnabled({
        mode: "full",
        switchable: true,
        onModeChange: () => undefined,
      }),
    ).toBe(true);
  });
});

describe("当前消息统一投影", () => {
  it("缺sequence历史按输入顺序保留文本，工具生命周期在首次位置归并且不制造输出", () => {
    const events = [
      createMessage(10, "初始普通说明"),
      createToolEvent(undefined, { status: ToolCallStatusEnum.Running }),
      createMessage(1, "**阶段结论** 内容"),
      createToolEvent(2),
      createMessage(3, "最终普通回复"),
    ];
    const original = structuredClone(events);
    const projection = buildAssistantTurnProjection(events, false);
    expect(projection.rawEvents).toBe(events);
    expect(events).toEqual(original);
    expect(projection.items.map((item) => item.kind)).toEqual([
      TurnItemKind.Reply,
      TurnItemKind.ProcessGroup,
      TurnItemKind.Reply,
      TurnItemKind.Reply,
    ]);
    const replies = projection.items.filter(
      (item) => item.kind === TurnItemKind.Reply,
    );
    expect(
      replies.map((item) => item.events.map((event) => event.message).join("")),
    ).toEqual(["初始普通说明", "**阶段结论** 内容", "最终普通回复"]);
    expect(replies.map((item) => item.important)).toEqual([false, true, false]);
    expect(projection.lastNonEmptyReplyKey).toBe(replies[2]?.key);
    expect(projection.observedToolCalls).toBe(1);
    const group = projection.items.find(
      (item) => item.kind === TurnItemKind.ProcessGroup,
    );
    const member = group?.members[0];
    expect(member?.kind).toBe(ProcessMemberKind.Tool);
    if (member?.kind !== ProcessMemberKind.Tool)
      throw new Error("缺少工具成员");
    expect(member.tool.source.sourceIndex).toBe(1);
    expect(member.tool.events).toHaveLength(2);
    expect(member.tool.derived.state).toBe(ToolCallStatusEnum.Success);
    expect(member.tool.derived.responseData).toBeNull();
    expect(projection.workingState).toBeUndefined();
  });
});

describe("isImportantAssistantMessage", () => {
  it.each([
    ["ATX 标题", "## 查询结论\n销售额同比增长 12%。"],
    ["Setext 标题", "查询结论\n===\n销售额同比增长 12%。"],
    ["换行的加粗标题与正文", "**查询结论**\n销售额同比增长 12%。"],
    ["同行的加粗标题与正文", "**查询结论**销售额同比增长 12%。"],
    ["同行的加粗标题、分隔符与正文", "**查询结论**：销售额同比增长 12%。"],
    ["仅有加粗标题", "  **查询结论**  "],
  ])("识别%s", (_name, message) => {
    expect(isImportantAssistantMessage(getMessageRenderItem(message))).toBe(
      true,
    );
  });

  it.each([
    ["普通文本", "已完成数据查询，正在整理结果。"],
    ["行内加粗", "普通说明包含 **强调文本**，但它不是标题。"],
    ["未闭合加粗", "**查询结论"],
    ["空加粗", "****"],
    ["正文中的 ATX 标题", "普通开场\n## 详细信息\n正文"],
    ["正文中的 Setext 标题", "普通开场\n详细信息\n---\n正文"],
  ])("不会把%s误判为重要消息", (_name, message) => {
    expect(isImportantAssistantMessage(getMessageRenderItem(message))).toBe(
      false,
    );
  });

  it("忽略代码围栏中的标题语法", () => {
    const message = [
      "```markdown",
      "# 代码示例中的标题",
      "**代码示例中的加粗**",
      "```",
      "普通说明",
    ].join("\n");

    expect(isImportantAssistantMessage(getMessageRenderItem(message))).toBe(
      false,
    );
  });
});

describe("deriveAssistantWorkingState", () => {
  it("仅有开始事件或文本进度时显示正在思考", () => {
    expect(deriveAssistantWorkingState([createStart(1)], true)).toBe(
      "thinking",
    );
    expect(deriveAssistantWorkingState([createThink(1)], true)).toBe(
      "thinking",
    );
    expect(
      deriveAssistantWorkingState([createMessage(1, "生成中")], true),
    ).toBe("thinking");
  });

  it("工具进度显示正在执行中", () => {
    expect(deriveAssistantWorkingState([createToolEvent(1)], true)).toBe(
      "executing-tools",
    );
  });

  it("未闭合压缩事件优先显示正在压缩上下文", () => {
    expect(
      deriveAssistantWorkingState(
        [
          createToolEvent(1),
          createCompressionStart(2),
          createMessage(3, "中间事件"),
        ],
        true,
      ),
    ).toBe("compressing-context");
  });

  it("压缩结束后恢复思考，后续工具仍可切换为执行中", () => {
    expect(
      deriveAssistantWorkingState(
        [createCompressionStart(1), createCompressionEnd(2)],
        true,
      ),
    ).toBe("thinking");
    expect(
      deriveAssistantWorkingState(
        [
          createCompressionStart(1),
          createCompressionEnd(2),
          createToolEvent(3),
        ],
        true,
      ),
    ).toBe("executing-tools");
  });

  it("消息结束后不再返回工作状态", () => {
    expect(
      deriveAssistantWorkingState([createToolEvent(1)], false),
    ).toBeUndefined();
  });
});
