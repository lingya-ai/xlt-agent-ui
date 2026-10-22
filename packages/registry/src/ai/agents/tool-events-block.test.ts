import {ToolExtensionFromJSON} from '@lingya-ai/agents-sdk/browser';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AiChatEventTypeEnum,
  ToolAction,
  ToolCallStatusEnum,
} from "../hooks/use-chat/schema";

import { ToolEventsBlock } from "./tool-events-block";
import type { ToolPresentation } from "./tool-presentation-projection";

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => ({
    ...Object.fromEntries(
      Object.entries({
        actionDefault: "工具调用",
        actionSearch: "搜索",
        actionRead: "读取",
        actionWrite: "写入",
        actionUpdate: "更新",
        actionDelete: "删除",
        actionExecute: "执行",
        actionInteract: "交互",
        actionDelegate: "委托",
        pending: "等待执行",
        running: "执行中",
        awaitingApproval: "等待审批",
        approvalResponded: "已响应审批",
        success: "已完成",
        noResult: "无结果",
        error: "执行失败",
        timeout: "执行超时",
        approvalDenied: "审批已拒绝",
        blocked: "已阻止",
        skipped: "已跳过",
        interrupted: "已中断",
        defaultError: "工具执行失败，未提供更多错误详情",
        defaultTimeout: "工具执行超时",
        defaultBlocked: "工具执行已被阻止",
        defaultApprovalDenied: "工具执行未获批准",
        defaultInterrupted: "工具执行已中断",
        historicalAnswer: "历史回答",
        selectedOptions: "已选择",
        noSelectedOptions: "未选择选项",
        customAnswer: "补充回答",
        unsupportedPreview: "此工具结果暂不支持专用预览",
      }).map(([key, value]) => [key, { value }]),
    ),
    fallbackTitle: ({
      action,
      toolName,
    }: {
      action: string;
      toolName: string;
    }) => ({
      value: `${action} ${toolName}`,
    }),
  }),
}));

vi.mock("../components/tool", () => ({
  getToolActionIcon: () => null,
  Tool: ({
    children,
    open,
    defaultOpen,
    onOpenChange,
  }: {
    children?: ReactNode;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    createElement(
      "div",
      { "data-testid": "tool", "data-open": String(open ?? defaultOpen) },
      createElement(
        "button",
        { onClick: () => onOpenChange?.(!(open ?? defaultOpen)) },
        "toggle",
      ),
      children,
    ),
  ToolContent: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  ToolHeader: ({
    state,
    title,
    type,
  }: {
    state: ToolCallStatusEnum;
    title: string;
    type: string;
  }) =>
    createElement(
      "div",
      {
        "data-testid": "tool-header",
        "data-state": state,
        "data-type": type,
      },
      title,
    ),
  ToolOutput: ({
    output,
    errorText,
  }: {
    output?: string;
    errorText?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "tool-output", "data-output": output ?? "" },
      errorText ?? output,
    ),
}));

vi.mock("./tool-awaiting-input", () => ({
  ToolAwaitingInput: ({
    interrupted,
    selectedOptions,
    question,
    onAnswer,
  }: {
    interrupted: boolean;
    selectedOptions?: string[];
    question: string;
    onAnswer?: unknown;
  }) =>
    createElement(
      "div",
      {
        "data-testid": "awaiting-input",
        "data-interrupted": String(interrupted),
        "data-selected-options": selectedOptions?.join(",") ?? "",
        "data-interactive": String(Boolean(onAnswer)),
      },
      question,
    ),
}));

vi.mock("./plan-approval-block", () => ({ PlanApprovalBlock: () => null }));
vi.mock("./sql-chart-result", () => ({ SqlChartResult: () => null }));
vi.mock("./sql-query-result", () => ({ SqlQueryResult: () => null }));
vi.mock("./sub-agent-block", () => ({ SubAgentBlock: () => null }));
vi.mock("./text-to-image-preview", () => ({ TextToImagePreview: () => null }));
vi.mock("./tool-code-extension", () => ({
  ToolCodeExtension: ({ kind, code }: { kind: string; code: string }) =>
    createElement(
      "div",
      { "data-testid": "code-extension", "data-kind": kind },
      code,
    ),
}));

const baseTool: ToolPresentation = {
  key: "tool-1",
  toolId: "tool-1",
  toolName: "askUserQuestion",
  source: {
    eventType: AiChatEventTypeEnum.ToolExecutionAwaitingUserInput,
    eventKey: "awaiting-input-1",
    sourceIndex: 0,
    toolId: "tool-1",
  },
  events: [],
  derived: {
    state: ToolCallStatusEnum.Running,
    action: ToolAction.INTERACT,
    awaitingInput: {
      questionId: "question-1",
      question: "是否继续？",
      questionDetails: "请选择一项",
      options: [{ text: "继续", recommended: true }],
      multiple: false,
      serverNow: new Date("2026-09-12T10:52:53.781Z"),
      timeoutSeconds: 1_800,
    },
  },
  keyResults: [],
  attention: {
    awaitingUserInput: true,
    awaitingPlanApproval: false,
    failed: false,
  },
};

afterEach(() => {
  cleanup();
});

describe("前端工具展示fallback", () => {
  it("specialRender工具默认展开，且中断消息仍展开重点内容", () => {
    const tool: ToolPresentation = {
      ...baseTool,
      specialRender: true,
    };

    const view = render(createElement(ToolEventsBlock, { tools: [tool] }));
    expect(screen.getByTestId("tool").getAttribute("data-open")).toBe("true");
    view.unmount();

    render(
      createElement(ToolEventsBlock, {
        tools: [tool],
        messageInterrupted: true,
      }),
    );
    expect(screen.getByTestId("tool").getAttribute("data-open")).toBe("true");
    expect(
      screen.getByTestId("awaiting-input").getAttribute("data-interrupted"),
    ).toBe("true");
  });

  it("重点工具仍允许恢复用户主动收起的选择", () => {
    const tool: ToolPresentation = {
      ...baseTool,
      specialRender: true,
    };

    render(
      createElement(ToolEventsBlock, {
        tools: [tool],
        getToolOpen: () => false,
      }),
    );

    expect(screen.getByTestId("tool").getAttribute("data-open")).toBe("false");
  });

  it.each([
    ["有选项", ["继续", "导出"], "补充详情"],
    ["仅补充", [], "只读说明"],
  ] as const)(
    "缺少等待事件的%s历史回答以只读专用结果显示，不产生重复Output",
    (_label, options, customInput) => {
      const onUserInputAnswer = vi.fn();
      const tool: ToolPresentation = {
        ...baseTool,
        derived: {
          action: ToolAction.INTERACT,
          state: ToolCallStatusEnum.Success,
          responseData: "已有业务摘要",
          askUserSelectedOptions: [...options],
          askUserCustomInput: customInput,
        },
      };
      render(
        createElement(ToolEventsBlock, { tools: [tool], onUserInputAnswer }),
      );
      const region = screen.getByRole("region", { name: "历史回答" });
      expect(region.textContent).toContain("已选择");
      expect(region.textContent).toContain("补充回答");
      expect(region.textContent).toContain(customInput);
      for (const option of options)
        expect(region.textContent).toContain(option);
      if (!options.length) expect(region.textContent).toContain("未选择选项");
      expect(region.querySelector("button,input,textarea")).toBeNull();
      expect(screen.queryByTestId("awaiting-input")).toBeNull();
      expect(screen.queryByTestId("tool-output")).toBeNull();
      expect(screen.getByTestId("tool").getAttribute("data-open")).toBe("false");
      expect(onUserInputAnswer).not.toHaveBeenCalled();
    },
  );
  it("单工具开合使用外置toolId键，未有记录时保留默认展开", () => {
    const onToolOpenChange = vi.fn();
    const view = render(
      createElement(ToolEventsBlock, {
        tools: [baseTool],
        getToolOpen: () => undefined,
        onToolOpenChange,
      }),
    );
    expect(screen.getByTestId("tool").getAttribute("data-open")).toBe("true");
    fireEvent.click(screen.getByText("toggle"));
    expect(onToolOpenChange).toHaveBeenCalledWith("tool-1", false);
    view.unmount();
    render(
      createElement(ToolEventsBlock, {
        tools: [baseTool],
        getToolOpen: () => false,
        onToolOpenChange,
      }),
    );
    expect(screen.getByTestId("tool").getAttribute("data-open")).toBe("false");
  });

  it("只读且尚未回答时仍显示问题，不传交互回调", () => {
    render(createElement(ToolEventsBlock, { tools: [baseTool] }));
    expect(screen.getByText("是否继续？")).toBeTruthy();
    expect(
      screen.getByTestId("awaiting-input").getAttribute("data-interactive"),
    ).toBe("false");
  });

  it("通用成功工具使用动作加工具名标题，不伪造Output", () => {
    const tool = {
      ...baseTool,
      toolName: "read-private-file",
      derived: {
        action: ToolAction.READ,
        state: ToolCallStatusEnum.Success,
        summary: null,
      },
    };
    render(createElement(ToolEventsBlock, { tools: [tool] }));
    expect(screen.getByText("读取 read-private-file")).toBeTruthy();
    expect(screen.queryByTestId("tool-header")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("已完成").closest(".sr-only")).toBeNull();
    expect(screen.queryByTestId("tool-output")).toBeNull();
  });

  it("MCP工具无业务摘要时保留完整工具名，状态不写入标题", () => {
    const toolName = "mcp__postgres_local__list_schemas__f7dac796d9";
    const tool: ToolPresentation = {
      ...baseTool,
      toolName,
      derived: {
        action: ToolAction.EXECUTE,
        state: ToolCallStatusEnum.Success,
        summary: null,
      },
    };
    render(createElement(ToolEventsBlock, { tools: [tool] }));
    const title = screen.getByText(`执行 ${toolName}`);
    expect(title.textContent).toBe(`执行 ${toolName}`);
    expect(screen.getByText("已完成")).toBeTruthy();
    expect(title.textContent).not.toContain("已完成");
  });

  it.each([
    ToolCallStatusEnum.Error,
    ToolCallStatusEnum.Timeout,
    ToolCallStatusEnum.Blocked,
    ToolCallStatusEnum.ApprovalDenied,
    ToolCallStatusEnum.Interrupted,
  ])("%s结果默认收起，展开后仍显示默认错误说明", (state) => {
    const tool = {
      ...baseTool,
      derived: { action: ToolAction.EXECUTE, state },
    };
    render(createElement(ToolEventsBlock, { tools: [tool] }));
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("tool-output")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByTestId("tool-output").textContent).toBeTruthy();
    expect(screen.getByTestId("tool-output").getAttribute("data-output")).toBe(
      "",
    );
  });

  it("保留业务摘要作为标题与真实输出", () => {
    const tool = {
      ...baseTool,
      derived: {
        action: ToolAction.READ,
        state: ToolCallStatusEnum.Success,
        responseData: "读取了3条记录",
      },
    };
    render(createElement(ToolEventsBlock, { tools: [tool] }));
    const trigger = screen.getByRole("button", { name: /读取了3条记录/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("tool-output")).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("tool-output").textContent).toBe("读取了3条记录");
    fireEvent.click(trigger);
    expect(screen.queryByTestId("tool-output")).toBeNull();
  });

  it("普通失败工具默认收起，允许手动展开并在重新挂载后恢复覆盖", () => {
    const tool: ToolPresentation = {
      ...baseTool,
      derived: { action: ToolAction.EXECUTE, state: ToolCallStatusEnum.Error },
    };
    const onToolOpenChange = vi.fn();
    const view = render(
      createElement(ToolEventsBlock, { tools: [tool], onToolOpenChange }),
    );
    const trigger = screen.getByRole("button", { name: /执行失败/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(onToolOpenChange).toHaveBeenCalledWith(tool.toolId, true);
    expect(screen.getByTestId("tool-output")).toBeTruthy();
    view.unmount();
    render(
      createElement(ToolEventsBlock, {
        tools: [tool],
        getToolOpen: () => true,
        onToolOpenChange,
      }),
    );
    expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByTestId("tool-output")).toBeTruthy();
  });

  it.each([
    [ToolCallStatusEnum.Pending, "等待执行"],
    [ToolCallStatusEnum.Running, "执行中"],
    [ToolCallStatusEnum.Success, "已完成"],
    [ToolCallStatusEnum.Error, "执行失败"],
    [ToolCallStatusEnum.Timeout, "执行超时"],
    [ToolCallStatusEnum.Interrupted, "已中断"],
  ])("%s工具有业务标题时也显示可见状态", (state, label) => {
    const tool: ToolPresentation = {
      ...baseTool,
      derived: { action: ToolAction.READ, state, summary: "业务说明" },
    };
    render(createElement(ToolEventsBlock, { tools: [tool] }));
    expect(screen.getByText("业务说明")).toBeTruthy();
    const status = screen.getByText(label);
    expect(status.closest(".sr-only")).toBeNull();
    expect(
      status.closest("[data-tool-state]")?.getAttribute("data-tool-state"),
    ).toBe(state);
    expect(screen.queryByTestId("tool-header")).toBeNull();
  });

  it("已知专用派生结果仍复用对应视图，不重复显示通用Output", () => {
    const tool: ToolPresentation = {
      ...baseTool,
      derived: {
        action: ToolAction.EXECUTE,
        state: ToolCallStatusEnum.Success,
        mathResult: { result: "3" },
        responseData: "计算完成",
      },
    };
    render(createElement(ToolEventsBlock, { tools: [tool] }));
    expect(screen.getByTestId("code-extension").textContent).toBe("3");
    expect(screen.getByTestId("code-extension").getAttribute("data-kind")).toBe(
      "math-result",
    );
    expect(screen.getByTestId("tool-header").textContent).toBe("计算完成");
    expect(screen.getByTestId("tool").getAttribute("data-open")).toBe("false");
    expect(screen.queryByTestId("tool-output")).toBeNull();
  });

  it("未知专用扩展只显示不支持说明，不曝光content", () => {
    const tool: ToolPresentation = {
      ...baseTool,
      derived: {
        action: ToolAction.EXECUTE,
        state: ToolCallStatusEnum.Success,
      },
      events: [
        {
          action: ToolAction.EXECUTE,
          type: AiChatEventTypeEnum.ToolExecution,
          toolId: "tool-1",
          toolName: "future-tool",
          status: ToolCallStatusEnum.Success,
          extension: ToolExtensionFromJSON({
            category: "future-preview",
            specialRender: true,
            content: { secret: "DO-NOT-DISPLAY" },
          }),
        },
      ],
    };
    render(createElement(ToolEventsBlock, { tools: [tool] }));
    expect(screen.getByText("此工具结果暂不支持专用预览")).toBeTruthy();
    expect(screen.queryByText(/DO-NOT-DISPLAY/)).toBeNull();
    expect(screen.queryByTestId("tool-output")).toBeNull();
  });
});

describe("提问工具中断状态", () => {
  it("未回答时以中断状态覆盖运行中标题并展示中断终态", () => {
    render(
      createElement(ToolEventsBlock, {
        tools: [baseTool],
        messageInterrupted: true,
      }),
    );

    expect(screen.getByTestId("tool-header").getAttribute("data-state")).toBe(
      ToolCallStatusEnum.Interrupted,
    );
    expect(
      screen.getByTestId("awaiting-input").getAttribute("data-interrupted"),
    ).toBe("true");
  });

  it("已有服务端回答时保持已回答结果优先", () => {
    const answeredTool: ToolPresentation = {
      ...baseTool,
      derived: {
        ...baseTool.derived,
        askUserSelectedOptions: ["继续"],
      },
    };

    render(
      createElement(ToolEventsBlock, {
        tools: [answeredTool],
        messageInterrupted: true,
      }),
    );

    expect(screen.getByTestId("tool-header").getAttribute("data-state")).toBe(
      ToolCallStatusEnum.Running,
    );
    expect(
      screen.getByTestId("awaiting-input").getAttribute("data-interrupted"),
    ).toBe("false");
    expect(
      screen
        .getByTestId("awaiting-input")
        .getAttribute("data-selected-options"),
    ).toBe("继续");
  });
});
