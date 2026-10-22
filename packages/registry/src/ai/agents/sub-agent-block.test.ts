// @vitest-environment jsdom
import { createElement, useState, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiChatEventTypeEnum,
  ToolAction,
  ToolCallStatusEnum,
} from "../hooks/use-chat/schema";
import { SubAgentBlock } from "./sub-agent-block";
import { ToolEventsBlock } from "./tool-events-block";
import type { ToolPresentation } from "./tool-presentation-projection";

const subAgent = vi.hoisted(() => ({
  load: vi.fn(),
  stop: vi.fn(),
  chatList: [{ id: "child-message" }],
}));
vi.mock("../hooks/use-chat/use-sub-agent-messages", () => ({
  useSubAgentMessages: () => ({ ...subAgent, isLoading: false }),
}));
vi.mock("./context", () => ({ useAiChatContext: () => ({ httpClient: {} }) }));
vi.mock("./agents-chat-message", () => ({
  AgentsChatMessage: () =>
    createElement(
      "div",
      { "data-chat-scroll": "", "data-testid": "child-messages" },
      "子智能体回复",
    ),
}));
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: (key: string) => {
    if (key === "sub-agent-block")
      return { subAgentCall: "子智能体调用", loading: "加载中" };
    if (key !== "tool-events-block")
      throw new Error(`缺少组件独立字典mock: ${key}`);
    return new Proxy(
      {},
      {
        get: (_target, name) =>
          name === "fallbackTitle"
            ? ({ action, toolName }: { action: string; toolName: string }) => ({
                value: `${action} ${toolName}`,
              })
            : { value: String(name) },
      },
    );
  },
}));
vi.mock("../components/tool", () => ({
  Tool: ({ children, open, defaultOpen }: { children?: ReactNode; open?: boolean; defaultOpen?: boolean }) =>
    createElement(
      "div",
      { "data-testid": "outer-tool", "data-open": String(open ?? defaultOpen) },
      children,
    ),
  ToolHeader: () => null,
  ToolContent: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  ToolOutput: () => null,
}));
vi.mock("./plan-approval-block", () => ({ PlanApprovalBlock: () => null }));
vi.mock("./sql-chart-result", () => ({ SqlChartResult: () => null }));
vi.mock("./sql-query-result", () => ({ SqlQueryResult: () => null }));
vi.mock("./text-to-image-preview", () => ({ TextToImagePreview: () => null }));
vi.mock("./tool-awaiting-input", () => ({ ToolAwaitingInput: () => null }));
vi.mock("./tool-code-extension", () => ({ ToolCodeExtension: () => null }));

const info = {
  conversationId: "sub-conversation",
  messageId: "sub-message",
  toolCallId: "parent-tool",
  toolName: "delegate",
};
const baseProps = {
  subAgentInfo: info,
  title: "子智能体结果",
  state: ToolCallStatusEnum.Success,
  action: ToolAction.DELEGATE,
};
const tool: ToolPresentation = {
  key: "tool:parent",
  toolId: "parent-tool",
  toolName: "delegate",
  events: [],
  keyResults: [],
  source: {
    eventType: AiChatEventTypeEnum.ToolExecutionSubAgentCall,
    eventKey: "sub-call",
    sourceIndex: 0,
  },
  derived: {
    state: ToolCallStatusEnum.Success,
    action: ToolAction.DELEGATE,
    subAgentInfo: info,
  },
  attention: {
    failed: false,
    awaitingUserInput: false,
    awaitingPlanApproval: false,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("子智能体消息区独立受控开合", () => {
  it("外部false只通知下一状态，在父级更新前不改变显示", () => {
    const onMessagesOpenChange = vi.fn();
    const view = render(
      createElement(SubAgentBlock, {
        ...baseProps,
        messagesOpen: false,
        onMessagesOpenChange,
      }),
    );
    const trigger = screen.getByRole("button", { name: "子智能体调用" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("child-messages")).toBeNull();
    fireEvent.click(trigger);
    expect(onMessagesOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId("child-messages")).toBeNull();
    view.rerender(
      createElement(SubAgentBlock, {
        ...baseProps,
        messagesOpen: true,
        onMessagesOpenChange,
      }),
    );
    expect(screen.getByTestId("child-messages")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "子智能体调用" }));
    expect(onMessagesOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("child-messages")).toBeTruthy();
  });

  it("父级清除消息区覆盖时恢复默认收起，不泄漏先前展开状态", () => {
    function Owner() {
      const [override, setOverride] = useState<boolean>();
      return createElement(
        "div",
        null,
        createElement(
          "button",
          { onClick: () => setOverride(undefined) },
          "清除覆盖",
        ),
        createElement(ToolEventsBlock, {
          tools: [tool],
          getSubAgentMessagesOpen: () => override,
          onSubAgentMessagesOpenChange: (toolId, open) => {
            expect(toolId).toBe("parent-tool");
            setOverride(open);
          },
        }),
      );
    }
    render(createElement(Owner));
    expect(screen.queryByTestId("child-messages")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "子智能体调用" }));
    expect(screen.getByTestId("child-messages")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "子智能体调用" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "清除覆盖" }));
    expect(
      screen
        .getByRole("button", { name: "子智能体调用" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByTestId("child-messages")).toBeNull();
  });

  it("不给接口时工具外框与消息区均默认收起，用户可主动展开", () => {
    render(createElement(SubAgentBlock, baseProps));
    expect(screen.getByTestId("outer-tool").getAttribute("data-open")).toBe("false");
    expect(screen.queryByTestId("child-messages")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "子智能体调用" }));
    expect(screen.getByTestId("child-messages")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "子智能体调用" }));
    expect(screen.queryByTestId("child-messages")).toBeNull();
  });

  it("仅给通知回调不丢失本地fallback", () => {
    const onMessagesOpenChange = vi.fn();
    render(
      createElement(SubAgentBlock, { ...baseProps, onMessagesOpenChange }),
    );
    fireEvent.click(screen.getByRole("button", { name: "子智能体调用" }));
    expect(screen.getByTestId("child-messages")).toBeTruthy();
    expect(onMessagesOpenChange).toHaveBeenCalledWith(true);
  });

  it("ToolEventsBlock以父toolId透传内层状态，外层开合回调相互独立且卸载后可恢复", () => {
    const onSubAgentMessagesOpenChange = vi.fn();
    const onToolOpenChange = vi.fn();
    const view = render(
      createElement(ToolEventsBlock, {
        tools: [tool],
        getToolOpen: () => true,
        onToolOpenChange,
        getSubAgentMessagesOpen: () => false,
        onSubAgentMessagesOpenChange,
      }),
    );
    expect(screen.getByTestId("outer-tool").getAttribute("data-open")).toBe(
      "true",
    );
    expect(screen.queryByTestId("child-messages")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "子智能体调用" }));
    expect(onSubAgentMessagesOpenChange).toHaveBeenCalledWith(
      "parent-tool",
      true,
    );
    expect(onToolOpenChange).not.toHaveBeenCalled();
    view.unmount();
    render(
      createElement(ToolEventsBlock, {
        tools: [tool],
        getToolOpen: () => true,
        getSubAgentMessagesOpen: () => true,
        onSubAgentMessagesOpenChange,
      }),
    );
    expect(
      screen
        .getByRole("button", { name: "子智能体调用" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByTestId("child-messages")).toBeTruthy();
    expect(subAgent.load).toHaveBeenCalledWith(info);
    expect(subAgent.stop).toHaveBeenCalledTimes(1);
  });
});
