import {AiChatEndBriefEventFromJSON, AiChatUserQueryBriefEventFromJSON, AiChatErrorBriefEventFromJSON, AiChatThinkBriefEventFromJSON, AiChatManualInterruptBriefEventFromJSON, AiChatMessageBriefEventFromJSON, AiChatToolExecutionBriefEventFromJSON, AiChatAwaitingInputBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import type { ChatItem } from "../hooks/use-chat/types";
import { consumeChatEvent } from "../hooks/use-chat/consume-chat-event";
import {ToolAction, AiChatEventTypeEnum, TOOL_EXTENSION_CATEGORY, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import { AgentsChatMessage } from "./agents-chat-message";

vi.mock("../../integration/access", () => ({
  PermissionExplanation: () => null,
}));
vi.mock("./use-ai-chat-access", () => ({
  useAiChatAccess: () => ({ canExecute: true, decisionFor: () => undefined }),
}));
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: (key: string) => {
    switch (key) {
      case "agents-chat-message":
        return {
          asyncFollowup: "异步任务后续回复",
          goalContinuation: "目标续跑",
          queued: "排队中",
          cancelQueued: { value: "取消排队" },
          copied: "已复制",
          expandUserMessage: "展开",
          collapseUserMessage: "收起",
          interrupted: "已中断",
          interruptedDescription: "本轮已停止",
          copyReply: { value: "复制回复" },
          thinking: "思考中",
          running: "运行中",
          interruptedByUser: "用户中断",
        };
      case "message-view-switcher":
        return {
          compactViewDescription: {value: "仅显示重要回复、重要工具和工具执行摘要"},
          fullViewDescription: {value: "显示思考消息、普通回复和完整工具执行过程"},
        };
      case "turn-execution-stats":
        return {
          roundSteps: ({ rounds, steps }: { rounds: number | string; steps: number | string }) => `${rounds}次${steps}步`,
          cacheHit: ({ rate }: { rate: string }) => `缓存命中${rate}`,
        };
      case "process-group":
        return {
          ...Object.fromEntries(
            Object.entries({
              search: "搜索",
              read: "读取",
              write: "写入",
              update: "修改",
              delete: "删除",
              execute: "执行",
              interact: "交互",
              delegate: "委派",
              default: "调用工具",
              thinking: "思考过程",
              thinkingRunning: "正在思考",
              runningSearch: "正在搜索",
              runningRead: "正在读取",
              runningWrite: "正在写入",
              runningUpdate: "正在修改",
              runningDelete: "正在删除",
              runningExecute: "正在执行",
              runningInteract: "等待你的操作",
              runningDelegate: "正在协调子智能体",
              runningDefault: "正在调用工具",
              preparingSearch: "准备搜索",
              preparingRead: "准备读取",
              preparingWrite: "准备写入",
              preparingUpdate: "准备修改",
              preparingDelete: "准备删除",
              preparingExecute: "准备执行",
              preparingInteract: "准备与你交互",
              preparingDelegate: "准备协调子智能体",
              preparingDefault: "准备调用工具",
              doneRead: "已读取",
              doneSearch: "已搜索",
              doneWrite: "已写入",
              doneUpdate: "已修改",
              doneDelete: "已删除",
              doneExecute: "已执行",
              doneInteract: "已与用户交互",
              doneDelegate: "已协调子智能体",
              doneDefault: "已调用工具",
              doneThinking: "已完成分析",
              doneSharedPrefix: "已",
              doneSeparator: "，",
              separator: "、",
              more: "等",
              expand: "展开过程组",
              collapse: "收起过程组",
            }).map(([name, value]) => [name, { value }]),
          ),
          doneJoinTwo: ({
            first,
            second,
          }: {
            first: string;
            second: string;
          }) => ({ value: `${first}并${second}` }),
          doneMore: ({ title }: { title: string }) => ({ value: `${title}等` }),
          attention: ({ activity }: { activity: string }) => ({
            value: `需要关注 · ${activity}`,
          }),
        };
      default:
        throw new Error(`测试缺少独立字典mock: ${key}`);
    }
  },
}));

const virtualRows = vi.hoisted(() => ({ hidden: new Set<string>() }));
vi.mock("./events.ts", () => ({
  useOptionalAiChatContextEvent: () => ({}),
  useAiChatContextEvent: () => ({ messageLoadRequestEvent: { emit: vi.fn() } }),
}));
vi.mock("./virtualized-message-list", () => ({
  VirtualizedMessageList: ({
    items,
    renderItem,
  }: {
    items: ChatItem[];
    renderItem: (item: ChatItem) => ReactNode;
  }) =>
    createElement(
      "div",
      null,
      items
        .filter((item) => !virtualRows.hidden.has(item.id))
        .map((item) =>
          createElement(
            "div",
            { key: item.id, "data-testid": `row-${item.id}` },
            renderItem(item),
          ),
        ),
    ),
}));
vi.mock("../components/message", () => ({
  Message: ({ children, from }: { children: ReactNode; from: string }) =>
    createElement("div", { "data-role": from }, children),
  MessageContent: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  MessageResponse: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
}));
vi.mock("../components/citation-message-response", () => ({
  CitationMessageResponse: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
}));
vi.mock("./context", () => ({ useAiChatContext: () => ({ httpClient: {} }) }));
vi.mock("../hooks/use-chat/use-citation-metadata", () => ({
  useCitationMetadata: () => vi.fn(),
}));
vi.mock("../components/knowledge-citation-sheet", () => ({
  KnowledgeCitationSheet: () => null,
}));
vi.mock("../components/tool", () => ({
  getToolActionIcon: (action: ToolAction) =>
    createElement("span", { "data-action-icon": action }),
}));
vi.mock("./tool-events-block", () => ({
  ToolEventsBlock: ({
    tools,
    messageInterrupted,
    getToolOpen,
    onToolOpenChange,
    onUserInputAnswer,
  }: {
    tools: import("./tool-presentation-projection").ToolPresentation[];
    messageInterrupted?: boolean;
    getToolOpen?: (toolId: string) => boolean | undefined;
    onToolOpenChange?: (toolId: string, open: boolean) => void;
    onUserInputAnswer?: unknown;
  }) =>
    createElement(
      "div",
      {
        "data-testid": "tool-events",
        "data-message-interrupted": String(Boolean(messageInterrupted)),
      },
      tools.map((tool) =>
        createElement(
          "div",
          {
            key: tool.toolId,
            "data-testid": `tool-${tool.toolId}`,
            "data-open": String(getToolOpen?.(tool.toolId) ?? true),
            "data-interactive": String(Boolean(onUserInputAnswer)),
          },
          createElement(
            "span",
            null,
            tool.derived.errorMessage ??
              tool.derived.responseData ??
              tool.derived.summary ??
              tool.toolName,
          ),
          tool.derived.awaitingInput
            ? createElement("span", null, tool.derived.awaitingInput.question)
            : null,
          createElement(
            "button",
            {
              "aria-label": `详情-${tool.toolId}`,
              onClick: () =>
                onToolOpenChange?.(
                  tool.toolId,
                  !(getToolOpen?.(tool.toolId) ?? true),
                ),
            },
            "工具详情",
          ),
        ),
      ),
    ),
}));

vi.mock("../components/reasoning", async () => {
  const React = await import("react");
  const Context = React.createContext<{
    open: boolean;
    change: (open: boolean) => void;
  }>({
    open: false,
    change: () => {},
  });
  return {
    Reasoning: ({
      children,
      open,
      onOpenChange,
    }: {
      children: ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) =>
      createElement(
        Context.Provider,
        { value: { open, change: onOpenChange } },
        children,
      ),
    ReasoningTrigger: () => {
      const state = React.useContext(Context);
      return createElement(
        "button",
        {
          "aria-expanded": state.open,
          onClick: () => state.change(!state.open),
          "aria-label": "思考详情",
        },
        "思考详情",
      );
    },
    ReasoningContent: ({ children }: { children: ReactNode }) =>
      React.useContext(Context).open
        ? createElement("div", { "data-testid": "reasoning-content" }, children)
        : null,
  };
});
vi.mock("./assistant-message-artifacts", () => ({
  AssistantMessageArtifacts: ({
    artifacts,
  }: {
    artifacts: { fileName: string }[];
  }) =>
    createElement(
      "div",
      { "data-testid": "artifacts" },
      artifacts.map((file) => file.fileName).join(","),
    ),
}));
vi.mock("./token-usage-details", () => ({
  TokenUsageDetails: ({ usage, compactLabel }: { usage: { totalTokens: number }; compactLabel?: ReactNode }) =>
    createElement(
      "span",
      { "data-testid": "token-usage" },
      compactLabel ?? String(usage.totalTokens),
    ),
}));
vi.mock("./user-message-attachments", () => ({
  UserMessageAttachments: ({
    attachments,
  }: {
    attachments: { fileName: string }[];
  }) =>
    createElement(
      "div",
      null,
      attachments.map((file) =>
        createElement("span", { key: file.fileName }, file.fileName),
      ),
    ),
}));
vi.mock("../../ui/components/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) =>
    createElement(
      "button",
      props,
      typeof children === "object" && children !== null && "value" in children
        ? String(children.value)
        : children,
    ),
}));

beforeEach(() => {
  vi.useFakeTimers();
  virtualRows.hidden.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function message(
  executionType: string,
  status = ConversationMessageStatus.COMPLETED,
): ChatItem {
  return {
    id: "message",
    loading: false,
    loaded: true,
    status,
    assistant: [],
    user: {
      text: "消息正文",
      executionType,
      attachments: [
        {
          fileId: 199,
          fileName: "audio.m4a",
          fileSize: 100,
          path: "attachments/audio.m4a",
          mimeType: "audio/mp4",
        },
      ],
    },
  };
}

function textEvent(text: string, key: string) {
  return AiChatMessageBriefEventFromJSON({
    type: AiChatEventTypeEnum.Message,
    key,
    message: text,
  });
}
function toolEvent(
  id: string,
  status = ToolCallStatusEnum.Success,
  summary: string | null = null,
) {
  return AiChatToolExecutionBriefEventFromJSON({
    type: AiChatEventTypeEnum.ToolExecution,
    key: `${id}-${status}`,
    toolId: id,
    toolName: id,
    action: ToolAction.READ,
    status,
    summary,
  });
}
function questionEvent() {
  return AiChatAwaitingInputBriefEventFromJSON({
    type: AiChatEventTypeEnum.ToolExecutionAwaitingUserInput,
    key: "question-event",
    toolCallId: "ask",
    toolName: "askUserQuestion",
    questionId: "question-id",
    question: "只读也能看到问题？",
    questionDetails: "选择一个选项",
    options: [{ text: "继续", recommended: true }],
    multiple: false,
    serverNow: "2026-09-12T10:52:53.781Z",
    timeoutSeconds: 1800,
  });
}

describe("会话消息类型展示", () => {
  it.each(["", "历史内部执行指令"])("历史目标续跑显示来源标识并隐藏用户正文 %s", text => {
    const item: ChatItem = {
      ...message("GOAL_CONTINUATION"),
      user: {text, executionType: "GOAL_CONTINUATION"},
      assistant: [textEvent("目标执行结果", "goal-result")],
    };
    const {container} = render(createElement(AgentsChatMessage, {chatList: [item]}));
    expect(screen.getByText("目标续跑")).toBeTruthy();
    expect(screen.getByText("目标执行结果")).toBeTruthy();
    expect(container.querySelector('[data-role="user"]')).toBeNull();
    expect(screen.queryByText("历史内部执行指令")).toBeNull();
  });

  it("公开事件不推断执行来源，消息元数据补齐后展示目标续跑", () => {
    const event = AiChatUserQueryBriefEventFromJSON({
      type: AiChatEventTypeEnum.UserQuery,
      executionType: "GOAL_CONTINUATION",
      query: "实时内部执行指令",
    });
    const item = consumeChatEvent({id: "goal", loading: true, loaded: true, assistant: []}, event);
    const view = render(createElement(AgentsChatMessage, {chatList: [item]}));
    expect(screen.queryByText("目标续跑")).toBeNull();
    expect(screen.getByText(event.query)).toBeTruthy();
    view.rerender(createElement(AgentsChatMessage, {chatList: [{
      ...item, user:{text:"",attachments:[],executionType:"GOAL_CONTINUATION"}, executionType: "GOAL_CONTINUATION", loading: false, status: ConversationMessageStatus.COMPLETED,
      assistant: [textEvent("续跑完成", "goal-done")],
    }]}));
    expect(screen.getByText("目标续跑")).toBeTruthy();
    expect(screen.getByText("续跑完成")).toBeTruthy();
    expect(view.container.querySelector('[data-role="user"]')).toBeNull();
  });

  it("在助手消息末尾渲染业务扩展内容", () => {
    const item = {
      ...message("USER_MESSAGE"),
      assistant: [
        AiChatMessageBriefEventFromJSON({
          type: AiChatEventTypeEnum.Message,
          message: "助手回复",
        }),
      ],
    };
    const renderFooter = vi.fn(
      ({
        chatItem,
        conversationId,
      }: {
        chatItem: ChatItem;
        conversationId?: string;
      }) =>
        createElement(
          "div",
          { "data-testid": "assistant-footer" },
          `${conversationId}:${chatItem.id}`,
        ),
    );
    const { container } = render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        conversationId: "conversation-1",
        renderAssistantMessageFooter: renderFooter,
      }),
    );

    expect(renderFooter).toHaveBeenCalledWith({
      chatItem: item,
      conversationId: "conversation-1",
    });
    expect(
      container.querySelector('[data-role="assistant"]')?.lastElementChild,
    ).toBe(screen.getByTestId("assistant-footer"));
    expect(screen.getByTestId("assistant-footer").textContent).toBe(
      "conversation-1:message",
    );
  });

  it("异步回调从排队变为完成后继续显示助手回复", () => {
    const item = message(
      "ASYNC_TASK_NOTIFICATION",
      ConversationMessageStatus.QUEUED,
    );
    const { rerender, container } = render(
      createElement(AgentsChatMessage, { chatList: [item] }),
    );
    expect(screen.getByText("排队中")).toBeTruthy();
    rerender(
      createElement(AgentsChatMessage, {
        chatList: [
          {
            ...item,
            status: ConversationMessageStatus.COMPLETED,
            assistant: [
              AiChatMessageBriefEventFromJSON({
                type: AiChatEventTypeEnum.Message,
                message: "转写结果",
              }),
            ],
          },
        ],
      }),
    );
    expect(screen.queryByText("排队中")).toBeNull();
    expect(screen.getByText("异步任务后续回复")).toBeTruthy();
    expect(screen.getByText("转写结果")).toBeTruthy();
    expect(container.querySelector('[data-role="user"]')).toBeNull();
  });
  it("只有嵌套类型的异步回调显示提示和排队状态，隐藏用户气泡与取消按钮", () => {
    const { container } = render(
      createElement(AgentsChatMessage, {
        chatList: [
          message("ASYNC_TASK_NOTIFICATION", ConversationMessageStatus.QUEUED),
        ],
        onCancelQueuedMessage: vi.fn(),
      }),
    );
    expect(screen.getByText("异步任务后续回复")).toBeTruthy();
    expect(screen.getByText("排队中")).toBeTruthy();
    expect(container.querySelector('[data-role="user"]')).toBeNull();
    expect(screen.queryByText("audio.m4a")).toBeNull();
    expect(screen.queryByRole("button", { name: "取消排队" })).toBeNull();
  });

  it.each(["USER_MESSAGE", "SUBAGENT", "FUTURE_TYPE"])(
    "%s 保留正文与附件",
    (executionType) => {
      const { container } = render(
        createElement(AgentsChatMessage, {
          chatList: [message(executionType)],
        }),
      );
      expect(container.querySelector('[data-role="user"]')).toBeTruthy();
      expect(screen.getByText("消息正文")).toBeTruthy();
      expect(screen.getByText("audio.m4a")).toBeTruthy();
      expect(screen.queryByText("异步任务后续回复")).toBeNull();
    },
  );

  it("普通排队消息仍提供取消按钮", () => {
    render(
      createElement(AgentsChatMessage, {
        chatList: [message("USER_MESSAGE", ConversationMessageStatus.QUEUED)],
        onCancelQueuedMessage: vi.fn(),
      }),
    );
    expect(screen.getByRole("button", { name: "取消排队" })).toBeTruthy();
  });

  it.each([
    ["消息元数据已中断", ConversationMessageStatus.INTERRUPTED, []],
    [
      "历史事件包含手动中断",
      ConversationMessageStatus.PENDING,
      [
        AiChatManualInterruptBriefEventFromJSON({
          type: AiChatEventTypeEnum.ManualInterrupt,
        }),
      ],
    ],
  ])("%s 时向工具块传递中断状态", (_, status, terminalEvents) => {
    const awaitingInputEvent =
      AiChatAwaitingInputBriefEventFromJSON({
        type: AiChatEventTypeEnum.ToolExecutionAwaitingUserInput,
        toolCallId: "tool-1",
        toolName: "askUserQuestion",
        questionId: "question-1",
        question: "是否继续？",
        questionDetails: "请选择一项",
        options: [{ text: "继续", recommended: true }],
        multiple: false,
        serverNow: "2026-09-12T10:52:53.781Z",
        timeoutSeconds: 1_800,
      });
    const item = message("USER_MESSAGE", status);

    render(
      createElement(AgentsChatMessage, {
        chatList: [
          { ...item, assistant: [awaitingInputEvent, ...terminalEvents] },
        ],
      }),
    );

    expect(screen.queryByTestId("tool-events")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开过程组" }));
    expect(
      screen
        .getByTestId("tool-events")
        .getAttribute("data-message-interrupted"),
    ).toBe("true");
  });

  it("重点工具旁的普通工具区段使用统一的可折叠摘要", () => {
    const ordinaryTool = AiChatToolExecutionBriefEventFromJSON({
      type: AiChatEventTypeEnum.ToolExecution,
      toolId: "tool-ordinary",
      toolName: "read_file",
      status: ToolCallStatusEnum.Success,
      summary: "已读取配置文件",
    });
    const planApprovalTool = AiChatToolExecutionBriefEventFromJSON({
      type: AiChatEventTypeEnum.ToolExecution,
      toolId: "tool-plan",
      toolName: "submit_plan",
      status: ToolCallStatusEnum.AwaitingApproval,
      summary: "等待计划审批",
      extension: {
        category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
        content: {
          previewFileId: 42,
          serverNow: "2026-09-12T10:52:53.781Z",
          approvalTimeoutAt: "2026-09-12T11:22:53.781Z",
        },
      },
    });
    const item = message("USER_MESSAGE");

    render(
      createElement(AgentsChatMessage, {
        chatList: [{ ...item, assistant: [ordinaryTool, planApprovalTool] }],
      }),
    );

    const trigger = screen.getByRole("button", { name: "展开过程组" });
    expect(screen.queryByTestId("tool-tool-ordinary")).toBeNull();
    expect(screen.getByTestId("tool-tool-plan")).toBeTruthy();

    fireEvent.click(trigger);

    expect(screen.getByTestId("tool-tool-ordinary").textContent).toContain(
      "已读取配置文件",
    );
    expect(screen.getAllByTestId("tool-tool-plan")).toHaveLength(1);
  });
});

describe("助手整轮与普通组集成", () => {
  it.each([
    { actions: [], title: "已完成分析", icon: undefined },
    { actions: [ToolAction.READ], title: "已读取", icon: ToolAction.READ },
    {
      actions: [ToolAction.READ, ToolAction.SEARCH],
      title: "已读取并搜索",
      icon: ToolAction.READ,
    },
    {
      actions: [ToolAction.READ, ToolAction.UPDATE, ToolAction.EXECUTE],
      title: "已读取，已修改，已执行",
      icon: ToolAction.READ,
    },
    {
      actions: [
        ToolAction.READ,
        ToolAction.UPDATE,
        ToolAction.EXECUTE,
        ToolAction.SEARCH,
      ],
      title: "已读取，已修改，已执行等",
      icon: ToolAction.READ,
    },
    {
      actions: [
        ToolAction.READ,
        ToolAction.SEARCH,
        ToolAction.SEARCH,
        ToolAction.READ,
      ],
      title: "已读取并搜索",
      icon: ToolAction.READ,
    },
    {
      actions: [
        ToolAction.READ,
        ToolAction.SEARCH,
        ToolAction.WRITE,
        ToolAction.WRITE,
        ToolAction.SEARCH,
        ToolAction.WRITE,
      ],
      title: "已写入，已搜索，已读取",
      icon: ToolAction.WRITE,
    },
  ])(
    "完成摘要按调用排名组合标题且不显示次数：$title",
    ({ actions, title, icon }) => {
      const item: ChatItem = {
        ...message("USER_MESSAGE"),
        assistant: [
          AiChatThinkBriefEventFromJSON({
            type: AiChatEventTypeEnum.Think,
            message: "旧思考预览",
          }),
          ...actions.map((action, index) =>
            AiChatToolExecutionBriefEventFromJSON({
              ...toolEvent(
                `call-${index}`,
                ToolCallStatusEnum.Success,
                "旧执行摘要",
              ),
              action,
            }),
          ),
          textEvent("最终正文", "final"),
        ],
      };
      render(createElement(AgentsChatMessage, { chatList: [item] }));
      // 组内有工具时是折叠触发器，没有工具时只是摘要行；标题都由 span 承载。
      const titleSpan = screen.getByText(title, { selector: "span" });
      const header = titleSpan.parentElement!;
      expect(header.textContent).toBe(title);
      expect(titleSpan.getAttribute("title")).toBe(title);
      expect(
        header
          .querySelector("[data-action-icon]")
          ?.getAttribute("data-action-icon"),
      ).toBe(icon);
    },
  );

  it.each(["compact", "full"] as const)("%s工具完成后的空档保持标题，重挂载恢复，结束立即清理预览", (mode) => {
    const initial: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [toolEvent("lazy", ToolCallStatusEnum.Running, "读取配置")],
    };
    const props = { conversationId: "lazy-header", showWorkingIndicator: false, messageView: { mode } };
    const view = render(createElement(AgentsChatMessage, { ...props, chatList: [initial] }));
    const header = () => screen.getByRole("button", { name: /过程组/ });
    expect(header().textContent).toBe("正在读取 · 读取配置");
    const completed = { ...initial, assistant: [...initial.assistant, toolEvent("lazy", ToolCallStatusEnum.Success, "完成结果")] };
    view.rerender(createElement(AgentsChatMessage, { ...props, chatList: [completed] }));
    act(() => vi.advanceTimersByTime(1000));
    expect(header().textContent).toBe("正在读取 · 读取配置");
    virtualRows.hidden.add(initial.id);
    view.rerender(createElement(AgentsChatMessage, { ...props, chatList: [completed] }));
    virtualRows.hidden.clear();
    view.rerender(createElement(AgentsChatMessage, { ...props, chatList: [completed] }));
    expect(header().textContent).toBe("正在读取 · 读取配置");
    const next = { ...completed, assistant: [...completed.assistant, toolEvent("next", ToolCallStatusEnum.Running)] };
    view.rerender(createElement(AgentsChatMessage, { ...props, chatList: [next] }));
    act(() => vi.advanceTimersByTime(150));
    expect(header().textContent).toBe("正在读取");
    view.rerender(createElement(AgentsChatMessage, { ...props, chatList: [{ ...next, loading: false, status: ConversationMessageStatus.COMPLETED }] }));
    expect(header().textContent).toBe("已读取");
    act(() => vi.advanceTimersByTime(1000));
    expect(header().textContent).toBe("已读取");
  });

  it("思考文字使用正在思考和最新段落，历史工具动作不覆盖当前思考标题", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [
        toolEvent("done"),
        AiChatThinkBriefEventFromJSON({
          type: AiChatEventTypeEnum.Think,
          message: "旧思考\n下一步分析",
        }),
      ],
    };
    render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        showWorkingIndicator: false,
      }),
    );
    const trigger = screen.getByRole("button", { name: "展开过程组" });
    expect(trigger.textContent).toBe("正在思考 · 旧思考 下一步分析");
    expect(trigger.querySelector(".lucide-brain")).toBeTruthy();
    expect(screen.queryByTestId("reasoning-content")).toBeNull();
  });

  it("最新工具无摘要时只展示当前动作，历史类别、助手及已结束思考不作为详情", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [
        toolEvent("read-1"),
        toolEvent("read-2"),
        textEvent("旧助手消息", "old-stage"),
        AiChatThinkBriefEventFromJSON({
          type: AiChatEventTypeEnum.Think,
          message: "已结束思考",
        }),
        AiChatToolExecutionBriefEventFromJSON({
          ...toolEvent("latest", ToolCallStatusEnum.Running),
          action: ToolAction.SEARCH,
        }),
      ],
    };
    render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        showWorkingIndicator: false,
      }),
    );
    const trigger = screen.getByRole("button", { name: "展开过程组" });
    expect(trigger.textContent).toBe("正在搜索");
    expect(
      trigger
        .querySelector("[data-action-icon]")
        ?.getAttribute("data-action-icon"),
    ).toBe(ToolAction.SEARCH);
    expect(trigger.querySelector("[title]")?.getAttribute("title")).toBe(
      "正在搜索",
    );
  });

  it("准备和执行标题整体更新，完成摘要立即出现，手动展开不受标题刷新影响", () => {
    const initial: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [toolEvent("live", ToolCallStatusEnum.Pending, "校验配置")],
    };
    const props = { showWorkingIndicator: false };
    const view = render(
      createElement(AgentsChatMessage, { ...props, chatList: [initial] }),
    );
    const trigger = screen.getByRole("button", { name: "展开过程组" });
    expect(trigger.textContent).toBe("准备读取 · 校验配置");
    fireEvent.click(trigger);
    const running = {
      ...initial,
      assistant: [
        ...initial.assistant,
        toolEvent("live", ToolCallStatusEnum.Running, "正在读取配置"),
      ],
    };
    view.rerender(
      createElement(AgentsChatMessage, { ...props, chatList: [running] }),
    );
    act(() => vi.advanceTimersByTime(149));
    expect(trigger.textContent).toBe("准备读取 · 校验配置");
    act(() => vi.advanceTimersByTime(1));
    expect(trigger.textContent).toBe("正在读取 · 正在读取配置");
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        chatList: [
          {
            ...running,
            loading: false,
            status: ConversationMessageStatus.COMPLETED,
          },
        ],
      }),
    );
    expect(trigger.textContent).toBe("已读取");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByTestId("tool-live")).toHaveLength(1);
  });

  it("回放每个阶段到来时保留同一过程组及手动展开，End后只显露末条正文", () => {
    const initial: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [textEvent("初始助手说明", "intro")],
    };
    const props = {
      showWorkingIndicator: false,
      conversationId: "stable-replay",
    };
    const view = render(
      createElement(AgentsChatMessage, { ...props, chatList: [initial] }),
    );
    const trigger = screen.queryByRole("button", { name: "展开过程组" });
    // 组内还没有工具时只显示摘要行，不提供展开入口。
    expect(trigger).toBeNull();
    expect(
      screen.getByText("正在思考 · 初始助手说明", { selector: "span" }),
    ).toBeTruthy();
    expect(screen.queryByText("初始助手说明", { exact: true })).toBeNull();
    const events = [
      toolEvent("a", ToolCallStatusEnum.Running, "读取中"),
      toolEvent("a", ToolCallStatusEnum.Success),
      textEvent("第一阶段", "stage-a"),
      toolEvent("b", ToolCallStatusEnum.Running),
      toolEvent("b", ToolCallStatusEnum.Success),
      textEvent("第二阶段", "stage-b"),
      toolEvent("c", ToolCallStatusEnum.Success),
      textEvent("最终正文", "final"),
    ];
    let current = initial;
    let header: HTMLElement | undefined;
    for (const event of events) {
      current = { ...current, assistant: [...current.assistant, event] };
      view.rerender(
        createElement(AgentsChatMessage, { ...props, chatList: [current] }),
      );
      act(() => vi.advanceTimersByTime(150));
      // 首个工具到达后组才提供展开入口，手动展开后全程保持同一节点。
      header ??= screen.getByRole("button", { name: "展开过程组" });
      if (header.getAttribute("aria-expanded") === "false")
        fireEvent.click(header);
      expect(
        screen.getAllByRole("button", { name: "收起过程组" }),
      ).toHaveLength(1);
      expect(screen.getByRole("button", { name: "收起过程组" })).toBe(header);
      expect(header.textContent).toContain(
        event.type === AiChatEventTypeEnum.ToolExecution
          ? "正在读取"
          : "正在思考",
      );
      expect(screen.getAllByTestId("tool-a")).toHaveLength(1);
      expect(screen.queryByText("第一阶段", { exact: true })).toBeNull();
      expect(screen.queryByText("第二阶段", { exact: true })).toBeNull();
      expect(screen.queryByText("最终正文", { exact: true })).toBeNull();
    }
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        chatList: [
          {
            ...current,
            loading: false,
            status: ConversationMessageStatus.COMPLETED,
            assistant: [
              ...current.assistant,
              AiChatEndBriefEventFromJSON({artifacts:[],nonFileArtifacts:[],
                type: AiChatEventTypeEnum.End,
                executionTimeMillis: 10000,
                totalUsage: {
                  inputTokens: 100,
                  outputTokens: 10,
                  totalTokens: 110,
                },
              }),
            ],
          },
        ],
      }),
    );
    expect(screen.getByRole("button", { name: "收起过程组" })).toBe(header);
    expect(header?.textContent).toBe("已读取");
    expect(screen.getByText("最终正文", { exact: true })).toBeTruthy();
    for (const id of ["a", "b", "c"])
      expect(screen.getAllByTestId(`tool-${id}`)).toHaveLength(1);
  });

  it("End制品之后展示耗时、次数和步数、Token及缓存统计，且统计只出现一次", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      processingSteps: 5,
      totalToolCalls: 13,
      executionTimeMillis: 6500,
      assistant: [
        textEvent("最终正文", "final"),
        AiChatEndBriefEventFromJSON({
          type: AiChatEventTypeEnum.End,
          executionTimeMillis: 10000,
          totalUsage: {
            inputTokens: 70000,
            outputTokens: 4400,
            totalTokens: 74400,
          },
          nonFileArtifacts: [],
          artifacts: [
            {
              fileId: 7,
              fileSize: 100,
              fileName: "report.xlsx",
              mimeType: "application/vnd.ms-excel",
            },
          ],
        }),
      ],
    };
    render(createElement(AgentsChatMessage, { chatList: [item] }));
    const usage = screen.getByTestId("token-usage");
    expect(usage.textContent).toBe("74.4k");
    expect(usage.parentElement?.textContent).toBe("10s · 5次13步 · 74.4k · 缓存命中—");
    for (const label of ["10s", "5次13步"]) {
      const stats = screen.getAllByText(label);
      expect(stats).toHaveLength(1);
      expect(
        stats[0]!.compareDocumentPosition(usage) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        screen.getByTestId("artifacts").compareDocumentPosition(stats[0]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("统计行在复制按钮之后渲染业务扩展操作", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [
        textEvent("最终正文", "final"),
        AiChatEndBriefEventFromJSON({artifacts:[],nonFileArtifacts:[],
          type: AiChatEventTypeEnum.End,
          executionTimeMillis: 10000,
          totalUsage: {
            inputTokens: 70000,
            outputTokens: 4400,
            totalTokens: 74400,
          },
        }),
      ],
    };
    render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        conversationId: "conversation-1",
        renderAssistantMessageStatsActions: ({ chatItem, conversationId }) =>
          createElement("button", {
            type: "button",
            "data-testid": "message-detail",
            "data-message-id": chatItem.id,
            "data-conversation-id": conversationId ?? "",
          }),
      }),
    );
    const detail = screen.getByTestId("message-detail");
    const copy = screen.getByRole("button", { name: "复制回复" });
    expect(detail.getAttribute("data-message-id")).toBe(item.id);
    expect(detail.getAttribute("data-conversation-id")).toBe("conversation-1");
    expect(
      copy.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("重点模式过程默认收起，标题随当前摘要和最新回复行更新", () => {
    const initial: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [
        toolEvent("live", ToolCallStatusEnum.Running, "读取配置\n检查字段"),
      ],
    };
    const props = {
      showWorkingIndicator: false,
      messageView: { mode: "compact" as const },
    };
    const view = render(
      createElement(AgentsChatMessage, { ...props, chatList: [initial] }),
    );
    const trigger = screen.getByRole("button", { name: "展开过程组" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toBe("正在读取 · 读取配置 检查字段");
    expect(screen.queryByTestId("tool-live")).toBeNull();
    const updated = {
      ...initial,
      assistant: [
        ...initial.assistant,
        toolEvent("live", ToolCallStatusEnum.Success),
        textEvent("助手旧行\n助手最新行", "live-reply"),
      ],
    };
    view.rerender(
      createElement(AgentsChatMessage, { ...props, chatList: [updated] }),
    );
    act(() => vi.advanceTimersByTime(150));
    const settledTrigger = screen.getByRole("button", { name: "展开过程组" });
    expect(settledTrigger.textContent).toContain("助手最新行");
    expect(settledTrigger.textContent).toBe("正在思考 · 助手最新行");
    expect(settledTrigger.textContent).not.toContain("读取配置");
    expect(settledTrigger.getAttribute("aria-expanded")).toBe("false");
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        chatList: [
          {
            ...updated,
            loading: false,
            status: ConversationMessageStatus.COMPLETED,
          },
        ],
      }),
    );
    const completedTrigger = screen.getByRole("button", {
      name: "展开过程组",
    });
    expect(completedTrigger.textContent).toBe("已读取");
    expect(
      completedTrigger.querySelector("[title]")?.getAttribute("title"),
    ).toBe("已读取");
    expect(screen.getByText(/助手旧行\s+助手最新行/).textContent).toBe(
      "助手旧行\n助手最新行",
    );
  });

  it("重点模式非最新分组只显示工具汇总，即使旧工具缺少终态事件", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [
        toolEvent("old", ToolCallStatusEnum.Running, "旧执行细节"),
        textEvent("**重要提示** 上阶段结束", "old-reply"),
        AiChatToolExecutionBriefEventFromJSON({
          ...toolEvent("current", ToolCallStatusEnum.Running, "最新执行细节"),
          action: ToolAction.SEARCH,
        }),
      ],
    };
    const view = render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        showWorkingIndicator: false,
        messageView: { mode: "compact" },
      }),
    );
    const triggers = screen.getAllByRole("button", { name: "展开过程组" });
    expect(triggers).toHaveLength(2);
    expect(triggers[0]?.textContent).toBe("已读取");
    expect(triggers[0]?.querySelector("[title]")?.getAttribute("title")).toBe(
      "已读取",
    );
    expect(triggers[1]?.textContent).toContain("正在搜索");
    expect(triggers[1]?.textContent).toContain("最新执行细节");
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [
          {
            ...item,
            loading: false,
            status: ConversationMessageStatus.COMPLETED,
          },
        ],
        showWorkingIndicator: false,
        messageView: { mode: "compact" },
      }),
    );
    expect(
      screen
        .getAllByRole("button", { name: "展开过程组" })
        .map((trigger) => trigger.textContent),
    ).toEqual(["已读取", "已搜索"]);
  });

  it("耗时和次数和步数统计位于回复末尾，折叠组不隐藏统计且没有整轮开关", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      executionTimeMillis: 10000,
      processingSteps: 5,
      totalToolCalls: 13,
      assistant: [toolEvent("ordinary"), textEvent("最终正文", "answer")],
    };
    render(createElement(AgentsChatMessage, { chatList: [item] }));
    const assistant = screen
      .getByTestId("row-message")
      .querySelector('[data-role="assistant"]');
    expect(assistant?.lastElementChild?.textContent).toContain("10s");
    expect(assistant?.lastElementChild?.textContent).toBe("10s · 5次13步");
    expect(
      screen
        .getByRole("button", { name: "展开过程组" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByRole("button", { name: /普通过程/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开过程组" }));
    fireEvent.click(screen.getByRole("button", { name: "收起过程组" }));
    expect(screen.getByText("最终正文")).toBeTruthy();
    expect(screen.getByText("5次13步")).toBeTruthy();
  });

  it("完整模式默认展开工具组，切换模式保留各自的展开状态", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [
        toolEvent("a"),
        textEvent("中间阶段", "stage"),
        toolEvent("b"),
        textEvent("最后回复", "final"),
      ],
    };
    const props = { chatList: [item], conversationId: "merge-persist" };
    const view = render(createElement(AgentsChatMessage, props));
    expect(screen.getAllByRole("button", { name: "展开过程组" })).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: "展开过程组" }));
    expect(screen.getAllByTestId("tool-a")).toHaveLength(1);
    expect(screen.getAllByTestId("tool-b")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /阶段回复/ })).toBeNull();
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        messageView: { mode: "full" },
      }),
    );
    expect(screen.getByText("中间阶段")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "收起过程组" })).toHaveLength(2);
    expect(screen.getByTestId("tool-a")).toBeTruthy();
    expect(screen.getByTestId("tool-b")).toBeTruthy();
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        messageView: { mode: "compact" },
      }),
    );
    expect(screen.getAllByRole("button", { name: "收起过程组" })).toHaveLength(
      1,
    );
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        messageView: { mode: "full" },
      }),
    );
    expect(screen.getAllByRole("button", { name: "收起过程组" })).toHaveLength(2);
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        messageView: { mode: "compact" },
      }),
    );
    expect(screen.getAllByRole("button", { name: "收起过程组" })).toHaveLength(
      1,
    );
    view.rerender(
      createElement(AgentsChatMessage, {
        ...props,
        messageView: { mode: "full" },
      }),
    );
    expect(screen.getAllByRole("button", { name: "收起过程组" })).toHaveLength(2);
  });

  it("执行中保留过程入口，不提供整轮收纳；full完整展示仍不重复tool", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE", ConversationMessageStatus.PENDING),
      loading: true,
      assistant: [
        AiChatThinkBriefEventFromJSON({
          type: AiChatEventTypeEnum.Think,
          key: "stream-think",
          message: "进行中思考",
        }),
        toolEvent("running", ToolCallStatusEnum.Running),
        textEvent("阶段回复", "stage"),
        toolEvent("running", ToolCallStatusEnum.Success),
        textEvent("最终回复", "final"),
      ],
    };
    const view = render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        showWorkingIndicator: false,
      }),
    );
    expect(screen.queryByRole("button", { name: "收起普通过程" })).toBeNull();
    expect(screen.getByRole("button", { name: "展开过程组" })).toBeTruthy();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [item],
        showWorkingIndicator: false,
        messageView: { mode: "full" },
      }),
    );
    expect(screen.getAllByRole("button", { name: "收起过程组" })).toHaveLength(1);
    expect(screen.getByTestId("reasoning-content").textContent).toBe(
      "进行中思考",
    );
    expect(screen.getByText("阶段回复")).toBeTruthy();
    expect(screen.getByText("最终回复")).toBeTruthy();
    expect(screen.getAllByTestId("tool-running")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "查看完整阶段回复" }),
    ).toBeNull();
  });

  it("工具和富结果默认收纳，重要与末条文本、轮级错误和制品保持可见", () => {
    const rich = AiChatToolExecutionBriefEventFromJSON({
      ...toolEvent("rich"),
      extension: {
        category: TOOL_EXTENSION_CATEGORY.MATH_RESULT,
        specialRender: true,
        content: { result: "42" },
      },
    });
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [
        toolEvent("ordinary"),
        textEvent("**重要提示** 保留", "important"),
        rich,
        toolEvent("failed", ToolCallStatusEnum.Error, "工具失败原因"),
        textEvent("末条非空回复", "final"),
        toolEvent("after-final"),
        textEvent("   ", "empty"),
        AiChatErrorBriefEventFromJSON({
          type: AiChatEventTypeEnum.Error,
          key: "error",
          message: "轮级错误",
        }),
        AiChatEndBriefEventFromJSON({
          type: AiChatEventTypeEnum.End,
          key: "end",
          executionTimeMillis: 100,
          totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          nonFileArtifacts: [],
          artifacts: [
            {
              fileId: 7,
              fileSize: 100,
              fileName: "report.xlsx",
              mimeType: "application/vnd.ms-excel",
            },
          ],
        }),
      ],
    };
    render(createElement(AgentsChatMessage, { chatList: [item] }));
    expect(screen.queryByRole("button", { name: /普通过程/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "展开过程组" })).toHaveLength(
      3,
    );
    expect(screen.queryByTestId("tool-ordinary")).toBeNull();
    expect(screen.getByText("**重要提示** 保留")).toBeTruthy();
    expect(screen.getByText("末条非空回复")).toBeTruthy();
    expect(screen.queryByTestId("tool-rich")).toBeTruthy();
    expect(screen.queryByTestId("tool-failed")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "展开过程组" })[1]!);
    expect(screen.getByTestId("tool-rich")).toBeTruthy();
    expect(screen.getByTestId("tool-failed").textContent).toContain(
      "工具失败原因",
    );
    expect(screen.getByText("轮级错误")).toBeTruthy();
    expect(screen.getByTestId("artifacts").textContent).toBe("report.xlsx");
    expect(screen.getByText("消息正文")).toBeTruthy();
    expect(screen.getByText("audio.m4a")).toBeTruthy();
  });

  it("跨阶段生命周期归并为唯一工具卡，组折叠可反复展开", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [
        toolEvent("same", ToolCallStatusEnum.Running),
        textEvent("阶段回复", "stage"),
        toolEvent("same", ToolCallStatusEnum.Success, "真实结果"),
        textEvent("最终回复", "final"),
      ],
    };
    render(createElement(AgentsChatMessage, { chatList: [item] }));
    expect(screen.queryByTestId("tool-same")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开过程组" }));
    expect(screen.getAllByTestId("tool-same")).toHaveLength(1);
    expect(screen.getByTestId("tool-same").textContent).toContain("真实结果");
    fireEvent.click(screen.getByRole("button", { name: "收起过程组" }));
    expect(screen.queryByTestId("tool-same")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "展开过程组" }));
    expect(screen.getAllByTestId("tool-same")).toHaveLength(1);
  });

  it("普通阶段回复随模式展示，重要阶段及末条文本始终可见", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [
        textEvent("普通阶段回复", "stage"),
        toolEvent("one"),
        textEvent("**重要阶段** 信息", "important"),
        toolEvent("two"),
        textEvent("最终非空文本", "final"),
      ],
    };
    const view = render(createElement(AgentsChatMessage, { chatList: [item] }));
    expect(screen.queryByText("普通阶段回复")).toBeNull();
    expect(screen.getByText("**重要阶段** 信息")).toBeTruthy();
    expect(screen.getByText("最终非空文本")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /阶段回复/ })).toBeNull();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [item],
        messageView: { mode: "full" },
      }),
    );
    expect(screen.getByText("普通阶段回复")).toBeTruthy();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [item],
        messageView: { mode: "compact" },
      }),
    );
    expect(screen.queryByText("普通阶段回复")).toBeNull();
    expect(screen.getByText("**重要阶段** 信息")).toBeTruthy();
    expect(screen.getByText("最终非空文本")).toBeTruthy();
  });

  it("虚拟行卸载、renderVersion更新仍恢复组与工具披露覆盖，重点模式组内不渲染思考", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [
        AiChatThinkBriefEventFromJSON({
          type: AiChatEventTypeEnum.Think,
          key: "think",
          message: "稳定的思考内容",
        }),
        toolEvent("detail"),
        textEvent("普通阶段", "stage"),
        toolEvent("boundary"),
        textEvent("最后文本", "final"),
      ],
    };
    const view = render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        conversationId: "persist",
      }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "展开过程组" })[0]!);
    // 重点模式展开过程组只渲染工具，思考与阶段文字都不进入组内。
    expect(screen.queryByTestId("reasoning-content")).toBeNull();
    expect(screen.queryByRole("button", { name: "思考详情" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "详情-detail" }));
    virtualRows.hidden.add(item.id);
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [...[item]],
        conversationId: "persist",
      }),
    );
    expect(screen.queryByTestId("row-message")).toBeNull();
    virtualRows.hidden.clear();
    const updated = {
      ...item,
      renderVersion: 2,
      assistant: [...item.assistant],
    };
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [updated],
        conversationId: "persist",
      }),
    );
    expect(screen.getByTestId("tool-detail").getAttribute("data-open")).toBe(
      "false",
    );
    expect(screen.queryByTestId("reasoning-content")).toBeNull();
    expect(screen.queryByText("普通阶段")).toBeNull();
    expect(screen.getByRole("button", { name: "收起过程组" })).toBeTruthy();
  });

  it("组覆盖随虚拟行卸载保存，切换会话恢复默认值且没有整轮开关", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [toolEvent("plain"), textEvent("最后回复", "final")],
    };
    const view = render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        conversationId: "c1",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "展开过程组" }));
    virtualRows.hidden.add(item.id);
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [item],
        conversationId: "c1",
      }),
    );
    virtualRows.hidden.clear();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [{ ...item, renderVersion: 5 }],
        conversationId: "c1",
      }),
    );
    expect(
      screen
        .getByRole("button", { name: "收起过程组" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByText("最后回复")).toBeTruthy();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [item],
        conversationId: "c2",
      }),
    );
    expect(
      screen
        .getByRole("button", { name: "展开过程组" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("后端真实零统计正常显示，pending统计不展示旧值或前端观测次数", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      processingSteps: 0,
      totalToolCalls: 0,
      messageStatsPending: false,
      assistant: [toolEvent("counted")],
    };
    const view = render(createElement(AgentsChatMessage, { chatList: [item] }));
    expect(screen.getByText("0次0步")).toBeTruthy();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [{ ...item, messageStatsPending: true }],
      }),
    );
    expect(screen.queryByText("0次0步")).toBeNull();
    expect(screen.queryByText(/已观测.*工具调用/)).toBeNull();
  });

  it.each([ToolCallStatusEnum.Running, ToolCallStatusEnum.Error])(
    "只读问答%s保留待回答入口，失败结果收纳且无交互callback",
    (state) => {
      const item: ChatItem = {
        ...message("USER_MESSAGE"),
        assistant: [
          toolEvent("plain"),
          questionEvent(),
          toolEvent("ask", state),
          textEvent("最后回复", "final"),
        ],
      };
      render(createElement(AgentsChatMessage, { chatList: [item] }));
      expect(screen.queryByRole("button", { name: /普通过程/ })).toBeNull();
      if (state === ToolCallStatusEnum.Error) {
        expect(screen.queryByTestId("tool-ask")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "展开过程组" }));
      }
      expect(screen.getByText("只读也能看到问题？")).toBeTruthy();
      expect(
        screen.getByTestId("tool-ask").getAttribute("data-interactive"),
      ).toBe("false");
    },
  );

  it("full纯空白回复不产生内容占位或披露按钮，后续有正文的空白前缀仍保留", () => {
    const item: ChatItem = {
      ...message("USER_MESSAGE"),
      assistant: [textEvent(" \n\t ", "only-whitespace")],
    };
    const view = render(
      createElement(AgentsChatMessage, {
        chatList: [item],
        messageView: { mode: "full" },
      }),
    );
    const assistant = screen
      .getByTestId("row-message")
      .querySelector('[data-role="assistant"]');
    expect(assistant?.childElementCount ?? 0).toBe(0);
    expect(
      screen.queryByRole("button", { name: /普通过程|阶段回复|过程组/ }),
    ).toBeNull();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [
          {
            ...item,
            assistant: [
              textEvent(" \n", "leading-whitespace"),
              textEvent("保留正文", "after-leading"),
            ],
          },
        ],
        messageView: { mode: "full" },
      }),
    );
    expect(screen.getByText("保留正文").textContent).toBe(" \n保留正文");
  });

  it("compact最终回复之后的纯空白不会让历史轮凭空出现整轮或阶段开关", () => {
    const history: ChatItem = {
      ...message("USER_MESSAGE"),
      id: "whitespace-history",
      assistant: [
        textEvent("历史最终回答", "whitespace-final"),
        AiChatErrorBriefEventFromJSON({
          type: AiChatEventTypeEnum.Error,
          key: "reply-boundary",
          message: "保留边界状态",
        }),
        textEvent(" \n\t ", "trailing-whitespace"),
      ],
    };
    const tail: ChatItem = {
      ...message("USER_MESSAGE"),
      id: "whitespace-tail",
      assistant: [textEvent("当前回答", "current-final")],
    };
    render(
      createElement(AgentsChatMessage, {
        chatList: [history, tail],
        messageView: { mode: "compact" },
      }),
    );
    const assistant = screen
      .getByTestId("row-whitespace-history")
      .querySelector('[data-role="assistant"]');
    expect(assistant).not.toBeNull();
    expect(assistant!.childElementCount).toBe(2);
    expect(
      Array.from(assistant!.children).every((child) =>
        Boolean(child.textContent?.trim()),
      ),
    ).toBe(true);
    expect(screen.getByText("历史最终回答")).toBeTruthy();
    expect(screen.getByText("保留边界状态")).toBeTruthy();
    expect(screen.getByText("当前回答")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /普通过程|阶段回复|过程组/ }),
    ).toBeNull();
  });

  it("历史非末轮保留合并过程入口和最终回复，模式切换恢复各阶段且没有整轮开关", () => {
    const history: ChatItem = {
      ...message("USER_MESSAGE"),
      id: "history",
      assistant: [
        toolEvent("history-one"),
        textEvent("历史第一阶段", "history-stage-one"),
        toolEvent("history-two"),
        textEvent("历史第二阶段", "history-stage-two"),
        toolEvent("history-three"),
        textEvent("历史最终非空回复", "history-final"),
      ],
    };
    const tail: ChatItem = {
      ...message("USER_MESSAGE"),
      id: "tail",
      assistant: [textEvent("当前最后一轮回复", "tail-final")],
    };
    const view = render(
      createElement(AgentsChatMessage, { chatList: [history, tail] }),
    );
    const assistant = screen
      .getByTestId("row-history")
      .querySelector('[data-role="assistant"]');
    expect(assistant).not.toBeNull();
    expect(assistant!.childElementCount).toBe(2);
    expect(
      assistant!.firstElementChild!.querySelector(
        'button[aria-expanded="false"]',
      ),
    ).toBeTruthy();
    expect(assistant!.lastElementChild!.textContent).toBe("历史最终非空回复");
    expect(
      Array.from(assistant!.children).every((child) =>
        Boolean(child.textContent?.trim()),
      ),
    ).toBe(true);
    expect(screen.queryByText("历史第一阶段")).toBeNull();
    expect(screen.queryByText("历史第二阶段")).toBeNull();
    expect(screen.queryByTestId("tool-history-one")).toBeNull();
    expect(screen.getByRole("button", { name: "展开过程组" })).toBeTruthy();
    expect(screen.getByText("当前最后一轮回复")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /普通过程/ })).toBeNull();
    view.rerender(
      createElement(AgentsChatMessage, {
        chatList: [history, tail],
        messageView: { mode: "full" },
      }),
    );
    expect(screen.getAllByRole("button", { name: "收起过程组" })).toHaveLength(3);
    expect(screen.getByText("历史第一阶段")).toBeTruthy();
    expect(screen.getByText("历史第二阶段")).toBeTruthy();
    expect(screen.getByText("历史最终非空回复")).toBeTruthy();
  });

  it("历史消息保留过程入口、异步回调提示、用户正文与末条助手回复", () => {
    const first: ChatItem = {
      ...message("ASYNC_TASK_NOTIFICATION"),
      id: "async",
      assistant: [
        toolEvent("async-plain"),
        textEvent("异步完成回复", "async-final"),
      ],
    };
    const second: ChatItem = {
      ...message("USER_MESSAGE"),
      id: "normal",
      assistant: [
        toolEvent("normal-plain"),
        textEvent("普通最终回复", "normal-final"),
      ],
    };
    render(createElement(AgentsChatMessage, { chatList: [first, second] }));
    expect(screen.getByTestId("row-async").textContent).toContain(
      "异步任务后续回复",
    );
    expect(screen.getByText("异步完成回复")).toBeTruthy();
    expect(screen.getByText("消息正文")).toBeTruthy();
    expect(screen.getByText("audio.m4a")).toBeTruthy();
    expect(screen.getByText("普通最终回复")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "展开过程组" })).toHaveLength(
      2,
    );
    expect(screen.queryByRole("button", { name: /普通过程/ })).toBeNull();
  });
});
