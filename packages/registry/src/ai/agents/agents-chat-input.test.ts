// @vitest-environment jsdom
import React, { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentsChatInput } from "./agents-chat-input";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";

vi.hoisted(() => {
  const Encoder = globalThis.TextEncoder;
  globalThis.TextEncoder = class extends Encoder {
    encode(input?: string) {
      return new Uint8Array(super.encode(input));
    }
  };
});
vi.stubGlobal("React", React);
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Element.prototype.scrollIntoView = vi.fn();
const originalFetch = globalThis.fetch;
Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: () => "blob:attachment",
});
Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  value: vi.fn(),
});

const state = vi.hoisted(() => ({
  split: false,
  loaded: false,
  canUpload: true,
  canExecute: true,
  refresh: vi.fn<() => Promise<void>>(),
  openWorkspace: vi.fn(),
  requestSplit: vi.fn<() => boolean>(),
  upload: vi.fn(),
}));
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () =>
    new Proxy(
      {},
      {
        get: (_, key) => {
          const node = {
            ...createElement("span", null, String(key)),
            value: String(key),
          };
          return key === "compactContextDescription" ? () => node : node;
        },
      },
    ),
}));
vi.mock("./context.tsx", () => ({
  useAiChatContext: () => ({ httpClient: {} }),
}));
vi.mock("./config", () => ({
  useAiChatConfigContext: () => ({
    config: {
      modelConfig: { modelKeyGroups: [] },
      maxAttachmentCount: 5,
    },
  }),
}));
vi.mock("./events", () => ({
  useAiChatContextEvent: () => ({
    chatInputTextInsertEvent: { useSubscription: () => undefined },
  }),
}));
vi.mock("./use-ai-chat-access", () => ({
  useAiChatAccess: () => ({
    canExecute: state.canExecute,
    canWrite: true,
    canSubmit: true,
    canUpload: state.canUpload,
    requireAccess: vi.fn(),
    decisionFor: () => undefined,
  }),
}));
vi.mock("../hooks/use-chat/use-upload-chat-attachment", () => ({
  useUploadChatAttachment: () => state.upload,
}));
vi.mock("./workspace-controller", () => ({
  useOptionalWorkspaceController: () => ({
    itemCount: 0,
    listLoaded: state.loaded,
    listLoading: false,
    refreshFiles: state.refresh,
    openWorkspace: state.openWorkspace,
  }),
}));
vi.mock("./agents-chat-workspace-layout", () => ({
  useAgentsChatWorkspaceLayout: () => ({
    isSplit: state.split,
    requestSplitPreview: state.requestSplit,
  }),
}));
vi.mock("./workspace-files-panel", () => ({
  WorkspaceFilesPanel: ({ open }: { open: boolean }) =>
    open ? createElement("div", null, "workspace-open") : null,
}));
vi.mock("./agents-chat-async-tasks", () => ({
  AgentsChatAsyncTasks: () => null,
}));
vi.mock("./agents-chat-subagents", () => ({ AgentsChatSubagents: () => null }));
vi.mock("./agents-chat-queue", () => ({ AgentsChatQueue: () => null }));
vi.mock("./task-progress-panel", () => ({ TaskProgressPanel: () => null }));
vi.mock("./agent-goal-bar", () => ({ AgentGoalBar: () => null }));
vi.mock("./agent-goal-details", () => ({ AgentGoalDetails: () => null }));

const goalConfig = {
  supported: true,
  continuationEnabled: false,
};
const goalController = {
  loading: false,
} as AgentGoalController;
const draft = () => screen.getByRole<HTMLTextAreaElement>("combobox");
const changeDraft = (value: string) =>
  fireEvent.change(draft(), {
    target: { value, selectionStart: value.length, selectionEnd: value.length },
  });
const launch = () =>
  fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
/** 附件上传需要真实完成，提交按钮才会解除禁用。 */
const attachFile = async (
  container: HTMLElement,
  name = "资料.txt",
): Promise<void> => {
  const fileInput =
    container.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(fileInput, {
    target: { files: [new File(["data"], name, { type: "text/plain" })] },
  });
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "submit" })
        .disabled,
    ).toBe(false),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  state.split = false;
  state.loaded = false;
  state.canUpload = true;
  state.canExecute = true;
  state.refresh.mockResolvedValue();
  state.requestSplit.mockImplementation(() => state.split);
  state.upload.mockResolvedValue(42);
  globalThis.fetch = vi.fn().mockResolvedValue({
    blob: async () => new Blob(["data"]),
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

it("同一会话的异步任务面板和目标栏使用独立 key", () => {
  const consoleError = vi.spyOn(console, "error");
  const props = {
    onSubmit: vi.fn(),
    enableSpeech: false,
    goalConfig,
    goalController,
  };
  const view = render(createElement(AgentsChatInput, props));
  for (const conversationId of ["conversation-a", "conversation-b", "conversation-a"]) {
    view.rerender(createElement(AgentsChatInput, { ...props, conversationId }));
  }
  expect(
    consoleError.mock.calls.filter(([message]) =>
      String(message).includes("Encountered two children with the same key"),
    ),
  ).toEqual([]);
});

it("主动选择计划随消息提交，失败保留草稿和选择", async () => {
  const submit = vi.fn().mockRejectedValue(new Error("offline"));
  render(
    createElement(AgentsChatInput, { onSubmit: submit, enableSpeech: false }),
  );
  expect(screen.queryByRole("button", { name: "planMode" })).toBeNull();
  launch();
  expect(screen.getByText("modeForNextMessage")).toBeTruthy();
  fireEvent.click(screen.getByRole("option", { name: "planMode" }));
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(submit).not.toHaveBeenCalled();
  changeDraft("分析方案");
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0]?.[1]).toMatchObject({
    planMode: true,
    goalMode: false,
  });
  await waitFor(() => expect(draft().value).toBe("分析方案"));
  launch();
  expect(
    screen.getByRole("option", { name: "planMode selected" }),
  ).toBeTruthy();
});

it("提交被业务状态阻断时，按钮与Enter都不能绕过", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    createElement(AgentsChatInput, {
      onSubmit: submit,
      submissionBlocked: true,
      enableSpeech: false,
    }),
  );
  changeDraft("等待数据库绑定");
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "submit" }).disabled,
  ).toBe(true);
  fireEvent.keyDown(draft(), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  expect(submit).not.toHaveBeenCalled();
});

it("回复生成中仍可选择下一条排队消息的模式", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    createElement(AgentsChatInput, {
      onSubmit: submit,
      isResponding: true,
      enableSpeech: false,
    }),
  );
  launch();
  const modeOption = screen.getByRole("option", {
    name: "planMode",
  });
  expect(modeOption.getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(modeOption);
  expect(submit).not.toHaveBeenCalled();
  changeDraft("下一条先做计划");
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0]?.[1]).toMatchObject({ planMode: true });
});

it("三种模式互斥，计划与目标可直接切换并重复点击关闭", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    createElement(AgentsChatInput, {
      onSubmit: submit,
      enableSpeech: false,
      goalConfig,
      goalController,
    }),
  );
  launch();
  fireEvent.click(screen.getByRole("option", { name: "planMode" }));
  changeDraft("先出计划");
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0]?.[1]).toMatchObject({
    planMode: true,
    goalMode: false,
  });

  launch();
  fireEvent.click(screen.getByRole("option", { name: "goalMode" }));
  expect(
    screen.queryByRole("option", { name: "planMode selected" }),
  ).toBeNull();
  changeDraft("直接做");
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit.mock.calls[1]?.[1]).toMatchObject({
    planMode: false,
    goalMode: true,
  });

  launch();
  fireEvent.click(screen.getByRole("option", { name: "goalMode selected" }));
  expect(screen.queryByRole("option", { name: /selected/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "disableGoalMode" })).toBeNull();
});

it("斜杠菜单通过键盘切换模式，仅移除命令并保留消息正文", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  render(
    createElement(AgentsChatInput, {
      onSubmit: submit,
      serverPlanMode: true,
      enableSpeech: false,
    }),
  );
  changeDraft("保留正文 /plan");
  expect(
    screen.getByRole("option", { name: "planMode selected" }),
  ).toBeTruthy();
  fireEvent.keyDown(draft(), { key: "Enter" });
  expect(draft().value).toBe("保留正文");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(submit).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "disablePlanMode" })).toBeNull();
  launch();
  expect(screen.getByRole("option", { name: "planMode" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("combobox", { name: "search" }), {
    key: "Escape",
  });
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0]?.[0]).toMatchObject({ query: "保留正文" });
  expect(submit.mock.calls[0]?.[1]).toMatchObject({
    planMode: false,
    goalMode: false,
  });
});

it("目标模式不打开创建弹窗，正文与附件随同一条消息提交", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const view = render(
    createElement(AgentsChatInput, {
      onSubmit: submit,
      enableSpeech: false,
      goalConfig,
      goalController,
      attachments: [{ ext: "txt", media: "text/plain" }],
    }),
  );
  launch();
  fireEvent.click(screen.getByRole("option", { name: "goalMode" }));
  changeDraft("整理资料");
  await attachFile(view.container);
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(submit.mock.calls[0]?.[0]).toMatchObject({
    query: "整理资料",
    files: [{ id: 42 }],
  });
  expect(submit.mock.calls[0]?.[1]).toMatchObject({
    goalMode: true,
    planMode: false,
  });
});

it("目标模式发送成功清空正文但保留模式，发送失败保留完整草稿", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const view = render(
    createElement(AgentsChatInput, {
      onSubmit: submit,
      enableSpeech: false,
      goalConfig,
      goalController,
      attachments: [{ ext: "txt", media: "text/plain" }],
    }),
  );
  launch();
  fireEvent.click(screen.getByRole("option", { name: "goalMode" }));
  changeDraft("整理资料");
  await attachFile(view.container);
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(draft().value).toBe("");
  expect(screen.getByRole("button", { name: "disableGoalMode" })).toBeTruthy();

  submit.mockRejectedValueOnce(new Error("offline"));
  changeDraft("继续整理");
  await attachFile(view.container, "补充.txt");
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(draft().value).toBe("继续整理");
  expect(screen.getByText("补充.txt")).toBeTruthy();
  expect(screen.getByRole("button", { name: "disableGoalMode" })).toBeTruthy();
});

it("激活模式按钮排在默认工具尾部并以分隔符分割，点击后退出模式", () => {
  render(
    createElement(AgentsChatInput, {
      onSubmit: vi.fn(),
      enableSpeech: false,
      attachments: [{ ext: "txt", media: "text/plain" }],
      goalConfig,
      goalController,
    }),
  );
  const toolOrder = () => {
    const row = document.querySelector(
      '[data-align="block-end"]',
    )?.firstElementChild;
    return Array.from(row?.firstElementChild?.children ?? []).map((child) =>
      child.getAttribute("data-orientation") === "vertical"
        ? "separator"
        : (child.getAttribute("aria-label") ?? ""),
    );
  };
  expect(toolOrder()).toEqual(["openMenu", "addAttachment", "workspace"]);
  launch();
  fireEvent.click(screen.getByRole("option", { name: "goalMode" }));
  // 模式和目标按钮必须落在默认工具之后，并由分隔符与默认工具分割。
  expect(toolOrder()).toEqual([
    "openMenu",
    "addAttachment",
    "workspace",
    "separator",
    "disableGoalMode",
  ]);
  const modeButton = screen.getByRole<HTMLButtonElement>("button", {
    name: "disableGoalMode",
  });
  expect(modeButton.getAttribute("aria-pressed")).toBe("true");
  expect(modeButton.getAttribute("title")).toBe("disableGoalMode");
  expect(modeButton.querySelectorAll("svg").length).toBe(2);
  // 分隔符必须显式声明竖直变体高度：Separator 默认的 h-full 会被解析为 0，分隔线不可见。
  const separator = document.querySelector<HTMLElement>(
    '[data-orientation="vertical"]',
  );
  expect(separator?.classList.contains("data-[orientation=vertical]:h-5")).toBe(
    true,
  );
  expect(
    separator?.classList.contains("data-[orientation=vertical]:h-full"),
  ).toBe(false);
  fireEvent.click(modeButton);
  expect(screen.queryByRole("button", { name: "disableGoalMode" })).toBeNull();
  expect(document.querySelector('[data-orientation="vertical"]')).toBeNull();
});

it("目标能力不可用时目标模式项禁用", () => {
  render(
    createElement(AgentsChatInput, { onSubmit: vi.fn(), enableSpeech: false }),
  );
  launch();
  expect(
    screen
      .getByRole("option", { name: "goalMode" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  expect(
    screen
      .getByRole("option", { name: "planMode" })
      .getAttribute("aria-disabled"),
  ).toBe("false");
});

it("审批期间隐藏输入和模式选择，停止入口保留，恢复后草稿仍在", () => {
  const stop = vi.fn();
  const props = {
    onSubmit: vi.fn(),
    enableSpeech: false,
    isResponding: true,
    onStop: stop,
  };
  const view = render(createElement(AgentsChatInput, props));
  changeDraft("未发送草稿");
  view.rerender(
    createElement(AgentsChatInput, { ...props, awaitingPlanApproval: true }),
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "openMenu" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "stopGeneration" }));
  expect(stop).toHaveBeenCalledTimes(1);
  view.rerender(createElement(AgentsChatInput, props));
  expect(draft().value).toBe("未发送草稿");
});

it.each([400, 200])(
  "附件和工作区按实际溢出显示文字或图标，可用宽度=%s",
  (width) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.parentElement?.getAttribute("data-align") === "block-end" ||
          this.getAttribute("data-align") === "block-end"
          ? width
          : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.parentElement?.getAttribute("data-align") !== "block-end")
          return 0;
        return Math.max(
          width,
          this.textContent?.includes("addAttachment") ? 300 : 140,
        );
      },
    );
    render(
      createElement(AgentsChatInput, {
        onSubmit: vi.fn(),
        enableSpeech: false,
        attachments: [{ ext: "txt", media: "text/plain" }],
        workspaceLabel: "工作区文件",
      }),
    );
    for (const name of ["addAttachment", "工作区文件"]) {
      const button = screen.getByRole("button", { name });
      expect(Boolean(button.textContent)).toBe(width >= 300);
      expect(button.getAttribute("data-size")).toBe(
        width >= 300 ? "sm" : "icon-sm",
      );
      expect(button.getAttribute("title")).toBe(name);
      expect(button.querySelector("svg")).not.toBeNull();
    }
    expect(screen.getByRole("button", { name: "submit" })).toBeTruthy();
  },
);

it("附件入口通过原文件选择器工作，隐藏开关与上传权限继续生效", () => {
  const props = {
    onSubmit: vi.fn(),
    enableSpeech: false,
    attachments: [{ ext: "txt", media: "text/plain" }],
  };
  const view = render(createElement(AgentsChatInput, props));
  const fileInput =
    view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const click = vi.spyOn(fileInput, "click");
  fireEvent.click(screen.getByRole("button", { name: "addAttachment" }));
  expect(click).toHaveBeenCalledTimes(1);
  expect(fileInput.accept).toBe("text/plain");
  launch();
  expect(screen.queryByRole("option", { name: "addAttachment" })).toBeNull();
  expect(screen.queryByRole("option", { name: "workspace" })).toBeNull();
  const menuSearch = screen.getByRole<HTMLInputElement>("combobox", {
    name: "search",
  });
  expect(
    document.getElementById(menuSearch.getAttribute("aria-controls") ?? ""),
  ).toBe(screen.getByRole("listbox"));
  state.canUpload = false;
  view.rerender(createElement(AgentsChatInput, props));
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "addAttachment" })
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "addAttachment" }));
  expect(click).toHaveBeenCalledTimes(1);
  view.rerender(
    createElement(AgentsChatInput, { ...props, showAttachments: false }),
  );
  expect(screen.queryByRole("button", { name: "addAttachment" })).toBeNull();
});

it.each([false, true])(
  "工作区独立按钮首次进入加载文件，分栏模式=%s",
  (split) => {
    state.split = split;
    render(
      createElement(AgentsChatInput, {
        onSubmit: vi.fn(),
        enableSpeech: false,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "workspace" }));
    expect(state.openWorkspace).toHaveBeenCalledTimes(1);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("workspace-open")).toBeNull();
  },
);

it("通用上下文菜单默认提供，隐藏用量圆环仍先确认再压缩；生成中禁止压缩", async () => {
  const compact = vi.fn().mockResolvedValue(undefined);
  const props = {
    onSubmit: vi.fn(),
    enableSpeech: false,
    showContextWindowUsage: false,
    conversationId: "conversation",
    onCompactContext: compact,
    messageContextUsageRatio: 0.5,
  };
  const view = render(createElement(AgentsChatInput, props));
  launch();
  fireEvent.click(screen.getByText("compactContext"));
  expect(compact).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("compactContextConfirm"));
  await waitFor(() => expect(compact).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByText("compactContextConfirm")).toBeNull(),
  );
  view.rerender(
    createElement(AgentsChatInput, { ...props, isResponding: true }),
  );
  launch();
  expect(
    screen
      .getByText("compactContext")
      .closest("[cmdk-item]")
      ?.getAttribute("aria-disabled"),
  ).toBe("true");
});

it("上下文组可以显式关闭，按钮和斜杠入口默认共用按需刷新", async () => {
  const refresh = vi.fn<() => Promise<void>>().mockResolvedValue();
  const props = {
    onSubmit: vi.fn(),
    enableSpeech: false,
    conversationId: "conversation",
    onRefreshContext: refresh,
    onCompactContext: vi.fn<() => Promise<void>>().mockResolvedValue(),
    showContextWindowUsage: false,
  };
  const view = render(createElement(AgentsChatInput, props));
  launch();
  expect(screen.getByText("contextGroup")).toBeTruthy();
  expect(screen.getByText("compactContext")).toBeTruthy();
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole("combobox", { name: "search" }), {
    target: { value: "compact" },
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  launch();
  changeDraft("/compact");
  expect(screen.getByText("compactContext")).toBeTruthy();
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  view.rerender(
    createElement(AgentsChatInput, {
      ...props,
      showContextCompactionCommand: false,
    }),
  );
  expect(screen.queryByText("contextGroup")).toBeNull();
  expect(screen.queryByText("compactContext")).toBeNull();
  expect(refresh).toHaveBeenCalledTimes(2);
});

it.each(["加号", "斜杠"])(
  "新会话的%s入口保留上下文组，禁用鼠标和键盘执行压缩",
  (entry) => {
    const compact = vi.fn<() => Promise<void>>().mockResolvedValue();
    const refresh = vi.fn<() => Promise<void>>().mockResolvedValue();
    const submit = vi.fn();
    render(
      createElement(AgentsChatInput, {
        onSubmit: submit,
        enableSpeech: false,
        onCompactContext: compact,
        onRefreshContext: refresh,
      }),
    );
    if (entry === "加号") launch();
    else changeDraft("/");
    expect(screen.getByText("contextGroup")).toBeTruthy();
    const item = screen.getByText("compactContext").closest("[cmdk-item]");
    expect(item?.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("noContext")).toBeTruthy();
    fireEvent.click(screen.getByText("compactContext"));
    const input =
      entry === "加号"
        ? screen.getByRole("combobox", { name: "search" })
        : draft();
    if (entry === "加号") {
      fireEvent.change(input, { target: { value: "compact" } });
    } else {
      changeDraft("/compact");
    }
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("compactContext")).toBeTruthy();
    expect(screen.queryByText("compactContextConfirm")).toBeNull();
    expect(compact).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  },
);

it("通用压缩菜单在无会话、缺少能力、首次读取和无执行权限时禁用", () => {
  const props = { onSubmit: vi.fn(), enableSpeech: false };
  const view = render(createElement(AgentsChatInput, props));
  launch();
  const disabled = () =>
    screen
      .getByText("compactContext")
      .closest("[cmdk-item]")
      ?.getAttribute("aria-disabled");
  expect(disabled()).toBe("true");
  expect(screen.getByText("noContext")).toBeTruthy();
  view.rerender(
    createElement(AgentsChatInput, {
      ...props,
      conversationId: "conversation",
    }),
  );
  launch();
  expect(disabled()).toBe("true");
  const compact = vi.fn<() => Promise<void>>().mockResolvedValue();
  view.rerender(
    createElement(AgentsChatInput, {
      ...props,
      conversationId: "conversation",
      onCompactContext: compact,
      contextUsageLoading: true,
    }),
  );
  expect(disabled()).toBe("true");
  expect(screen.getByText("contextUsageLoading")).toBeTruthy();
  state.canExecute = false;
  view.rerender(
    createElement(AgentsChatInput, {
      ...props,
      conversationId: "conversation",
      onCompactContext: compact,
    }),
  );
  expect(disabled()).toBe("true");
  fireEvent.click(screen.getByText("compactContext"));
  expect(screen.queryByText("compactContextConfirm")).toBeNull();
  expect(compact).not.toHaveBeenCalled();
});

it("生成中空草稿停止，有草稿继续发送，视图选择与新对话复用回调", async () => {
  const stop = vi.fn();
  const restart = vi.fn();
  const submit = vi.fn().mockResolvedValue(undefined);
  const changeView = vi.fn();
  render(
    createElement(AgentsChatInput, {
      onSubmit: submit,
      enableSpeech: false,
      isResponding: true,
      onStop: stop,
      onRestart: restart,
      messageView: { mode: "compact", onModeChange: changeView },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "stopGeneration" }));
  expect(stop).toHaveBeenCalledTimes(1);
  changeDraft("继续处理");
  fireEvent.click(screen.getByRole("button", { name: "submit" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0]?.[0]).toEqual({
    query: "继续处理",
    files: undefined,
  });
  launch();
  fireEvent.click(screen.getByText("fullView"));
  expect(changeView).toHaveBeenCalledWith("full");
  launch();
  fireEvent.click(screen.getByText("newConversation"));
  expect(restart).toHaveBeenCalledTimes(1);
});
