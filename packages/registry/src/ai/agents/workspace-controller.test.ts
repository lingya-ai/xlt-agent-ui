// @vitest-environment jsdom

import {
  createElement,
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TerminalWorkspaceArtifactsEvent } from "./events";
import {
  WorkspaceControllerProvider,
  WorkspaceTab,
  type WorkspaceControllerValue,
  useWorkspaceController,
} from "./workspace-controller";
import type { WorkspaceArtifactList } from "../hooks/use-chat/use-workspace-files";
import { WorkspaceNonFileArtifactKindEnum } from "../hooks/use-chat/workspace-non-file-artifact-schema";
import { WorkspaceContentTabs } from "./workspace-content-tabs";
import { AgentsChatWorkspaceLayout } from "./agents-chat-workspace-layout";

const workspaceTestState = vi.hoisted(() => ({
  width: 1200,
  conversationId: undefined as string | undefined,
  terminalListener: undefined as
    | ((event: TerminalWorkspaceArtifactsEvent) => void)
    | undefined,
  fetchWorkspaceFiles:
    vi.fn<(conversationId: string) => Promise<WorkspaceArtifactList>>(),
}));

vi.mock("ahooks", () => ({
  useSize: () => ({ width: workspaceTestState.width, height: 600 }),
}));
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => {
    const node = (value: string) => ({
      ...createElement("span", null, value),
      value,
    });
    return {
      ...Object.fromEntries(
        Object.entries({
          home: "开始",
          artifacts: "工作区制品",
          artifactsDescription: "查看文件",
          subagents: "子智能体列表",
          subagentsDescription: "查看任务",
          goalHistory: "目标历史",
          goalHistoryDescription: "查看目标",
          tabsLabel: "工作区标签页",
          closeWorkspace: "收起工作区",
          title: "工作区",
          description: "工作区内容",
          refreshFiles: "刷新文件",
          refreshPreview: "刷新预览",
          currentVersion: "当前版本",
          historicalVersion: "历史版本",
        }).map(([key, value]) => [key, node(value)]),
      ),
      closeTab: ({ title }: { title: string }) => node(`关闭 ${title}`),
    };
  },
}));
vi.mock("./workspace-file-previewers", () => ({ workspaceFilePreviewers: [] }));
vi.mock("./file-preview-sheet", () => ({
  FilePreviewContent: ({ fileId,relativePath }: { fileId?: number;relativePath?:string }) =>
    createElement("div", null, fileId ? `文件版本 ${fileId}` : `工作区路径 ${relativePath}`),
}));
vi.mock("./workspace-file-download-action", () => ({
  WorkspaceFileDownloadAction: () => null,
}));
vi.mock("./workspace-artifact-list", () => ({
  WorkspaceArtifactList: ({
    files,
    onSelectFile,
  }: {
    files: WorkspaceArtifactList["fileArtifacts"]["records"];
    onSelectFile: (
      file: WorkspaceArtifactList["fileArtifacts"]["records"][number],
    ) => void;
  }) =>
    createElement(
      "div",
      null,
      files.map((file) =>
        createElement(
          "button",
          { key: file.relativePath, onClick: () => onSelectFile(file) },
          file.fileName,
        ),
      ),
    ),
  WorkspaceNonFileArtifactPreview: () => null,
}));

vi.mock("./context.tsx", () => ({
  useAiChatContext: () => ({ httpClient: {} }),
}));

vi.mock("./events", () => ({
  useAiChatContextEvent: () => ({
    conversationId: workspaceTestState.conversationId,
    terminalWorkspaceArtifactsEvent: {
      useSubscription: (
        listener: (event: TerminalWorkspaceArtifactsEvent) => void,
      ) => {
        workspaceTestState.terminalListener = listener;
      },
    },
  }),
}));

vi.mock("../hooks/use-chat/use-workspace-files", () => ({
  useWorkspaceFiles: () => workspaceTestState.fetchWorkspaceFiles,
}));

vi.mock("../../api/hooks/use-api-request", () => ({
  useApiRequest: (service: (...params: unknown[]) => Promise<unknown>) => {
    const [loading, setLoading] = useState(false);
    const requestIdRef = useRef(0);
    const serviceRef = useRef(service);
    serviceRef.current = service;

    const runAsync = useCallback(async (...params: unknown[]) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const response = await serviceRef.current(...params);
        if (requestId !== requestIdRef.current) {
          throw new Error("Request was canceled");
        }
        return response;
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, []);

    const cancel = useCallback(() => {
      requestIdRef.current += 1;
      setLoading(false);
    }, []);

    useEffect(() => () => cancel(), [cancel]);

    return { loading, runAsync, cancel };
  },
}));

function createWorkspaceResponse(
  fileTotal = 0,
  nonFileCount = 0,
): WorkspaceArtifactList {
  return {
    fileArtifacts: {
      records:
        fileTotal > 0
          ? [
              {
                relativePath: "reports/result.pdf",
                size: 1024,
                fileName: "result.pdf",
                mimeType: "application/pdf",
                lastUpdateTime: new Date("2026-09-12T00:00:00Z"),
              },
            ]
          : [],
      page: { current: 0, size: 100, total: fileTotal },
    },
    nonFileArtifacts: Array.from({ length: nonFileCount }, (_, index) => ({
      kind: WorkspaceNonFileArtifactKindEnum.HTML_PAGE,
      artifactId: index + 1,
      title: `页面 ${index + 1}`,
      description: "预览页面",
      lastUpdateTime: new Date("2026-09-12T00:00:00Z"),
      previewUrl: "https://example.com/preview",
    })),
  };
}

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

let controllerValue: WorkspaceControllerValue | undefined;

function WorkspaceControllerProbe() {
  controllerValue = useWorkspaceController();
  return null;
}

function renderController(strictMode = false) {
  const provider = createElement(
    WorkspaceControllerProvider,
    null,
    createElement(WorkspaceControllerProbe),
  );
  return render(
    strictMode ? createElement(StrictMode, null, provider) : provider,
  );
}

function emitTerminalEvent(event: TerminalWorkspaceArtifactsEvent) {
  act(() => workspaceTestState.terminalListener?.(event));
}

afterEach(cleanup);

beforeEach(() => {
  workspaceTestState.width = 1200;
  controllerValue = undefined;
  workspaceTestState.conversationId = undefined;
  workspaceTestState.terminalListener = undefined;
  workspaceTestState.fetchWorkspaceFiles.mockReset();
  workspaceTestState.fetchWorkspaceFiles.mockResolvedValue(
    createWorkspaceResponse(),
  );
});

describe("WorkspaceControllerProvider", () => {
  it("开始页入口和文件共用标签栏，重复打开聚焦已有标签，关闭后恢复键盘焦点", async () => {
    workspaceTestState.conversationId = "workbench";
    workspaceTestState.fetchWorkspaceFiles.mockResolvedValue(
      createWorkspaceResponse(1),
    );
    render(
      createElement(
        WorkspaceControllerProvider,
        null,
        createElement(WorkspaceControllerProbe),
        createElement(WorkspaceContentTabs),
      ),
    );
    await waitFor(() => expect(controllerValue?.listLoaded).toBe(true));
    fireEvent.click(
      screen.getByRole("button", { name: "工作区制品 查看文件" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "result.pdf" }));
    expect(screen.getByText("工作区路径 reports/result.pdf")).toBeTruthy();
    act(() => controllerValue?.showHome());
    fireEvent.click(
      screen.getByRole("button", { name: "工作区制品 查看文件" }),
    );
    expect(screen.getAllByRole("tab", { name: "工作区制品" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "result.pdf" }));
    expect(screen.getAllByRole("tab", { name: "result.pdf" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "关闭 result.pdf" }));
    expect(controllerValue?.activeTabKey).toBe("artifacts");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "工作区制品" }),
    );
    expect(screen.queryByRole("button", { name: "关闭 开始" })).toBeNull();
  });

  it("宽度切换只改变分栏和抽屉宿主，收起后再打开保留标签与聊天子树", async () => {
    workspaceTestState.conversationId = "layout";
    const content = () =>
      createElement(
        WorkspaceControllerProvider,
        null,
        createElement(WorkspaceControllerProbe),
        createElement(
          AgentsChatWorkspaceLayout,
          null,
          createElement("input", { "aria-label": "聊天输入" }),
        ),
      );
    const view = render(content());
    await waitFor(() => expect(controllerValue?.listLoaded).toBe(true));
    const chat = screen.getByRole("textbox", { name: "聊天输入" });
    act(() =>
      controllerValue?.openFilePreview({ fileId: 1, fileName: "report.pdf" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    workspaceTestState.width = 600;
    view.rerender(content());
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(controllerValue?.activeTabKey).toBe("file:layout:1");
    expect(controllerValue?.tabs).toHaveLength(2);
    act(() => controllerValue?.closeWorkspace());
    act(() => controllerValue?.openWorkspace());
    workspaceTestState.width = 1200;
    view.rerender(content());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("textbox", { name: "聊天输入" })).toBe(chat);
    expect(
      screen
        .getByRole("tab", { name: "report.pdf" })
        .getAttribute("data-state"),
    ).toBe("active");
  });
  it("开始页固定，工作区路径与消息版本分别标识，相同消息版本去重", async () => {
    workspaceTestState.conversationId = "first";
    workspaceTestState.fetchWorkspaceFiles.mockResolvedValue(
      createWorkspaceResponse(1),
    );
    renderController();
    await waitFor(() => expect(controllerValue?.listLoaded).toBe(true));
    expect(controllerValue?.activeTabKey).toBe("home");
    const file = controllerValue?.files[0];
    if (!file) throw new Error("测试文件缺失");
    act(() => controllerValue?.setTab(WorkspaceTab.Artifacts));
    act(() => controllerValue?.selectFile(file));
    act(() =>
      controllerValue?.openArtifact(
        {
          fileId: 1,
          deliveryStatus: "AVAILABLE",issueCodes: [],recoverable: false,
          fileName: file.fileName,
          mimeType: "application/pdf",
          fileSize: 1024,
          relativePath: file.relativePath,
        },
        "child",
      ),
    );
    expect(controllerValue?.tabs.map((page) => page.key)).toEqual([
      "home",
      "artifacts",
      "workspace-path:first:reports/result.pdf",
      "file:child:1",
    ]);
    act(() =>
      controllerValue?.openFilePreview({
        fileId: 9,
        fileName: file.fileName,
        relativePath: file.relativePath,
      }),
    );
    expect(controllerValue?.tabs.map((page) => page.key)).toEqual([
      "home",
      "artifacts",
      "workspace-path:first:reports/result.pdf",
      "file:child:1",
      "file:first:9",
    ]);
    act(() => controllerValue?.closeTab("file:first:9"));
    expect(controllerValue?.activeTabKey).toBe("file:child:1");
    act(() => controllerValue?.closeTab("home"));
    expect(controllerValue?.tabs[0]?.key).toBe("home");
  });

  it("收起后重新打开保留标签，换会话立即隔离旧状态", async () => {
    workspaceTestState.conversationId = "first";
    const view = renderController();
    await waitFor(() => expect(controllerValue?.listLoaded).toBe(true));
    act(() =>
      controllerValue?.openFilePreview({
        fileId: 5,
        conversationId: "child",
        fileName: "result.pdf",
      }),
    );
    act(() => controllerValue?.closeWorkspace());
    expect(controllerValue?.workspaceOpen).toBe(false);
    act(() => controllerValue?.openWorkspace());
    expect(controllerValue?.activeTabKey).toBe("file:child:5");
    expect(controllerValue?.tabs[1]).toMatchObject({
      file: { conversationId: "child" },
    });
    workspaceTestState.conversationId = "second";
    view.rerender(
      createElement(
        WorkspaceControllerProvider,
        null,
        createElement(WorkspaceControllerProbe),
      ),
    );
    expect(controllerValue?.activeTabKey).toBe("home");
    expect(controllerValue?.tabs).toHaveLength(1);
    expect(controllerValue?.workspaceOpen).toBe(false);
    await waitFor(() => expect(controllerValue?.listLoaded).toBe(true));
  });

  it("终态的新文件版本不替换旧标签，也不抢占焦点", async () => {
    workspaceTestState.conversationId = "first";
    renderController();
    await waitFor(() => expect(controllerValue?.listLoaded).toBe(true));
    act(() =>
      controllerValue?.openFilePreview({
        fileId: 5,
        fileName: "result.pdf",
        relativePath: "reports/result.pdf",
      }),
    );
    act(() => controllerValue?.showHome());
    emitTerminalEvent({
      conversationId: "first",
      messageId: "updated",
      terminalType: "end",
      artifacts: [
        {
          fileId: 6,
          deliveryStatus: "AVAILABLE", issueCodes: [], recoverable: false,
          fileName: "result.pdf",
          fileSize: 10,
          mimeType: "application/pdf",
          relativePath: "reports/result.pdf",
        },
      ],
      nonFileArtifacts: [],
    });
    expect(controllerValue?.activeTabKey).toBe("home");
    expect(controllerValue?.tabs[1]).toMatchObject({
      key: "file:first:5",
      file: { fileId: 5 },
    });
    act(() => controllerValue?.closeTab("file:first:5"));
    await waitFor(() =>
      expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(2),
    );
    expect(controllerValue?.tabs).toHaveLength(1);
  });

  it("Strict Mode 清理后仍能完成首次加载且不重复请求", async () => {
    workspaceTestState.conversationId = "conversation-strict";
    workspaceTestState.fetchWorkspaceFiles.mockResolvedValue(
      createWorkspaceResponse(8),
    );

    renderController(true);

    await waitFor(() => expect(controllerValue?.listLoaded).toBe(true));
    expect(controllerValue?.listLoading).toBe(false);
    expect(controllerValue?.itemCount).toBe(8);
    expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(1);
  });

  it("仅在会话 ID 可用后立即加载一次，并使用分页总数计算数量", async () => {
    const view = renderController();
    expect(workspaceTestState.fetchWorkspaceFiles).not.toHaveBeenCalled();

    workspaceTestState.conversationId = "conversation-1";
    view.rerender(
      createElement(
        WorkspaceControllerProvider,
        null,
        createElement(WorkspaceControllerProbe),
      ),
    );

    await waitFor(() =>
      expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(1),
    );
    expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledWith(
      "conversation-1",
      { current: 0, size: 100 },
    );

    workspaceTestState.fetchWorkspaceFiles.mockResolvedValue(
      createWorkspaceResponse(137, 2),
    );
    await act(async () => controllerValue?.refreshFiles());

    expect(controllerValue?.itemCount).toBe(139);
    expect(controllerValue?.listLoaded).toBe(true);
  });

  it("空终态不刷新，加载期间的多个制品终态合并为一次尾随刷新", async () => {
    const firstRequest = createDeferred<WorkspaceArtifactList>();
    workspaceTestState.conversationId = "conversation-1";
    workspaceTestState.fetchWorkspaceFiles
      .mockImplementationOnce(() => firstRequest.promise)
      .mockResolvedValue(createWorkspaceResponse(2));
    renderController();

    await waitFor(() =>
      expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(1),
    );
    emitTerminalEvent({
      terminalType: "end",
      conversationId: "conversation-1",
      messageId: "empty-message",
      artifacts: [],
      nonFileArtifacts: [],
    });
    expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(1);

    for (const messageId of ["artifact-message-1", "artifact-message-2"]) {
      emitTerminalEvent({
        terminalType: "end",
        conversationId: "conversation-1",
        messageId,
        artifacts: [
          {
            fileId: 1,
            deliveryStatus: "AVAILABLE", issueCodes: [], recoverable: false,
            fileSize: 1024,
            fileName: "result.pdf",
            mimeType: "application/pdf",
            relativePath: "reports/result.pdf",
          },
        ],
        nonFileArtifacts: [],
      });
    }
    expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstRequest.resolve(createWorkspaceResponse(1));
      await firstRequest.promise;
    });
    await waitFor(() =>
      expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(2),
    );
  });

  it("切换会话后忽略旧会话的迟到响应", async () => {
    const oldRequest = createDeferred<WorkspaceArtifactList>();
    const newRequest = createDeferred<WorkspaceArtifactList>();
    workspaceTestState.conversationId = "conversation-old";
    workspaceTestState.fetchWorkspaceFiles.mockImplementationOnce(
      () => oldRequest.promise,
    );
    const view = renderController();
    await waitFor(() =>
      expect(workspaceTestState.fetchWorkspaceFiles).toHaveBeenCalledTimes(1),
    );

    workspaceTestState.fetchWorkspaceFiles.mockImplementationOnce(
      () => newRequest.promise,
    );
    workspaceTestState.conversationId = "conversation-new";
    view.rerender(
      createElement(
        WorkspaceControllerProvider,
        null,
        createElement(WorkspaceControllerProbe),
      ),
    );

    expect(controllerValue?.itemCount).toBe(0);
    expect(controllerValue?.listLoaded).toBe(false);
    await act(async () => {
      newRequest.resolve(createWorkspaceResponse(4, 1));
      await newRequest.promise;
    });
    await waitFor(() => expect(controllerValue?.itemCount).toBe(5));
    await act(async () => {
      oldRequest.resolve(createWorkspaceResponse(99));
      await oldRequest.promise;
    });
    expect(controllerValue?.itemCount).toBe(5);
  });

  it("首次失败保留未加载状态，并允许手动重试", async () => {
    workspaceTestState.conversationId = "conversation-1";
    workspaceTestState.fetchWorkspaceFiles.mockRejectedValueOnce(
      new Error("network error"),
    );
    renderController();

    await waitFor(() =>
      expect(controllerValue?.listError).toBeInstanceOf(Error),
    );
    expect(controllerValue?.listLoaded).toBe(false);

    workspaceTestState.fetchWorkspaceFiles.mockResolvedValueOnce(
      createWorkspaceResponse(3),
    );
    await act(async () => controllerValue?.refreshFiles());
    expect(controllerValue?.listLoaded).toBe(true);
    expect(controllerValue?.itemCount).toBe(3);
    expect(controllerValue?.listError).toBeUndefined();
  });
});
