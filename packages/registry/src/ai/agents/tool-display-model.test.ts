import { messages } from "../../i18n/messages";
const toolEventsBlockContent = {key: "tool-events-block", content: messages["tool-events-block"]};
function getDictionary(dictionary: typeof toolEventsBlockContent, locale: "zh" | "en") {
 return Object.fromEntries(Object.entries(dictionary.content).map(([key, value]) => [key, value.locales[locale]]));
}
import { describe, expect, it } from "vitest";

import {
  AiChatEventTypeEnum,
  ToolAction,
  ToolCallStatusEnum,
} from "../hooks/use-chat/schema";
import {
  buildToolDisplayModel,
  ToolDisplayLabelKind,
} from "./tool-display-model";
import type { ToolPresentation } from "./tool-presentation-projection";

function makeTool(
  action: ToolAction,
  state: ToolCallStatusEnum,
): ToolPresentation {
  return {
    key: "tool",
    toolId: "tool",
    toolName: "opaque-tool",
    source: {
      eventType: AiChatEventTypeEnum.ToolExecution,
      eventKey: "event",
      sourceIndex: 0,
    },
    events: [],
    keyResults: [],
    derived: { action, state, summary: null },
    attention: {
      awaitingUserInput: false,
      awaitingPlanApproval: false,
      failed: false,
    },
  };
}

describe("渲染端独立字典", () => {
  it("中文fallback含动作、状态、错误与不支持说明", () => {
    expect(getDictionary(toolEventsBlockContent, "zh")).toMatchObject({
      actionRead: "读取",
      success: "已完成",
      defaultError: "工具执行失败，未提供更多错误详情",
      unsupportedPreview: "此工具结果暂不支持专用预览",
    });
  });
  it("英文fallback与中文使用同一组件独立key", () => {
    expect(toolEventsBlockContent.key).toBe("tool-events-block");
    expect(getDictionary(toolEventsBlockContent, "en")).toMatchObject({
      actionRead: "Read",
      success: "Completed",
      defaultError: "The tool failed without additional error details",
      unsupportedPreview:
        "A dedicated preview is not supported for this tool result",
    });
  });
});

describe("纯工具展示模型", () => {
  it.each(Object.values(ToolAction))(
    "保留%s枚举，无摘要时不合成输出",
    (action) => {
      for (const state of Object.values(ToolCallStatusEnum)) {
        const tool = makeTool(action, state);
        const snapshot = structuredClone(tool);
        const model = buildToolDisplayModel(tool);
        expect(model.action).toBe(action);
        expect(model.state).toBe(state);
        expect(model.labelKind).toBe(ToolDisplayLabelKind.ActionStatus);
        expect(model.businessTitle).toBeUndefined();
        expect(model.output).toBeUndefined();
        expect(tool).toEqual(snapshot);
      }
    },
  );

  it("专用SQL业务摘要优先，既有真实响应保持不变", () => {
    const tool = makeTool(ToolAction.READ, ToolCallStatusEnum.Success);
    tool.derived.sqlResultSummary = "SQL业务摘要";
    tool.derived.responseData = "已有业务输出";
    expect(buildToolDisplayModel(tool)).toMatchObject({
      labelKind: ToolDisplayLabelKind.Business,
      businessTitle: "SQL业务摘要",
      output: "已有业务输出",
    });
  });

  it("真实错误摘要优先于旧运行摘要", () => {
    const tool = makeTool(ToolAction.EXECUTE, ToolCallStatusEnum.Error);
    tool.derived.errorMessage = "业务错误";
    tool.derived.summary = "旧运行摘要";
    expect(buildToolDisplayModel(tool)).toMatchObject({
      businessTitle: "业务错误",
      errorText: "业务错误",
      failureKind: ToolCallStatusEnum.Error,
    });
  });

  it("空白业务摘要不阻断默认标题和失败提示", () => {
    const tool = makeTool(ToolAction.DEFAULT, ToolCallStatusEnum.Timeout);
    tool.derived.errorMessage = "  ";
    expect(buildToolDisplayModel(tool)).toMatchObject({
      labelKind: ToolDisplayLabelKind.ActionStatus,
      failureKind: ToolCallStatusEnum.Timeout,
    });
    expect(buildToolDisplayModel(tool).errorText).toBeUndefined();
  });
});
