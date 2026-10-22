"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useApiRequest } from "../../api/hooks/use-api-request";
import { useAiChatContext } from "./context";
import { useAiChatContextEvent } from "./events";
import { getWorkspaceNonFileArtifactPreviewUrl } from "./workspace-non-file-artifact-utils";
import type { Artifacts } from "../hooks/use-chat/schema";
import {
  useWorkspaceFiles,
  type WorkspaceFile,
  type WorkspaceNonFileArtifact,
} from "../hooks/use-chat/use-workspace-files";

import type { AgentGoalConfig } from "../hooks/use-chat/agent-goal-schema";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";
import type { SubagentTasksState } from "../hooks/use-chat/use-subagent-tasks";

import { useWorkspaceTabs } from "./use-workspace-tabs";
import {
  WorkspacePageKind,
  updateWorkspaceNonFilePages,
  type WorkspacePage,
  type WorkspaceFilePreviewInput,
} from "./workspace-tabs-state";
export { WorkspacePageKind as WorkspaceTab } from "./workspace-tabs-state";
export type { WorkspaceFilePreviewInput } from "./workspace-tabs-state";

type WorkspaceGoalState = {
  controller: AgentGoalController;
  config: AgentGoalConfig;
};

export type WorkspaceControllerValue = {
  files: WorkspaceFile[];
  nonFileArtifacts: WorkspaceNonFileArtifact[];
  itemCount: number;
  listLoading: boolean;
  listLoaded: boolean;
  listError?: Error;
  selectedPath?: string;
  tabs: WorkspacePage[];
  activeTabKey: string;
  workspaceOpen: boolean;
  openWorkspace: () => void;
  closeWorkspace: () => void;
  activateTab: (key: string) => void;
  closeTab: (key: string) => void;
  showHome: () => void;
  openFilePreview: (file: WorkspaceFilePreviewInput) => void;
  subagents?: SubagentTasksState;
  goal?: WorkspaceGoalState;
  readOnly: boolean;
  setTab: (
    tab:
      | WorkspacePageKind.Home
      | WorkspacePageKind.Artifacts
      | WorkspacePageKind.Subagents
      | WorkspacePageKind.GoalHistory,
  ) => void;
  showSubagents: () => void;
  selectSubagent: (taskId: string) => void;
  refreshFiles: () => Promise<void>;
  selectFile: (file: WorkspaceFile) => void;
  openArtifact: (artifact: Artifacts, conversationId?: string) => void;
  openNonFileArtifact: (artifact: WorkspaceNonFileArtifact) => void;
  refreshCurrentPreview: () => void;
};

type WorkspaceControllerProviderProps = {
  children: ReactNode;
  enabled?: boolean;
  subagents?: SubagentTasksState;
  goal?: WorkspaceGoalState;
  readOnly?: boolean;
};

type WorkspaceRequestFlight = {
  conversationId: string;
  generation: number;
  token: symbol;
  promise: Promise<void>;
};

type WorkspaceListErrorState = {
  conversationId: string;
  error: Error;
};

const WorkspaceControllerContext =
  createContext<WorkspaceControllerValue | null>(null);

/**
 * 工作区共享状态。
 *
 * 会话可用后立即加载工作区；终态事件包含制品时触发一次对账刷新。
 * 消息文件固定到 fileId，工作区文件使用当前路径；终态仅对账列表并更新相同 ID 的非文件制品。
 */
export function WorkspaceControllerProvider({
  children,
  enabled = true,
  subagents,
  goal,
  readOnly = false,
}: WorkspaceControllerProviderProps) {
  const { httpClient } = useAiChatContext();
  const fetchWorkspaceFiles = useWorkspaceFiles({ httpClient });
  const { conversationId, terminalWorkspaceArtifactsEvent } =
    useAiChatContextEvent();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [nonFileArtifacts, setNonFileArtifacts] = useState<
    WorkspaceNonFileArtifact[]
  >([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [loadedConversationId, setLoadedConversationId] = useState<string>();
  const [listErrorState, setListErrorState] =
    useState<WorkspaceListErrorState>();
  const [selectedPath, setSelectedPath] = useState<string>();
  const { tabs, activeTabKey, openTab, activateTab, closeTab, updateTabs } =
    useWorkspaceTabs(
      conversationId,
      Boolean(subagents),
      Boolean(goal) && !readOnly,
    );
  const [panelState, setPanelState] = useState<{
    conversationId?: string;
    open: boolean;
  }>({ conversationId, open: false });
  const workspaceOpen =
    panelState.conversationId === conversationId && panelState.open;
  const openWorkspace = useCallback(
    () => setPanelState({ conversationId, open: true }),
    [conversationId],
  );
  const closeWorkspace = useCallback(
    () => setPanelState({ conversationId, open: false }),
    [conversationId],
  );
  useEffect(() => {
    setPanelState((current) =>
      current.conversationId === conversationId
        ? current
        : { conversationId, open: false },
    );
  }, [conversationId]);
  const generationRef = useRef(0);
  const flightRef = useRef<WorkspaceRequestFlight | undefined>(undefined);
  const trailingRefreshRef = useRef(false);
  const refreshFilesRef = useRef<() => Promise<void>>(async () => undefined);
  const terminalKeysRef = useRef(new Set<string>());
  const activeContextRef = useRef({ conversationId, enabled });
  activeContextRef.current = { conversationId, enabled };

  const {
    loading: requestLoading,
    runAsync: runWorkspaceRequest,
    cancel: cancelWorkspaceRequest,
  } = useApiRequest(
    (targetConversationId: string) =>
      fetchWorkspaceFiles(targetConversationId, { current: 0, size: 100 }),
    {
      manual: true,
      disableErrorNotification: true,
    },
  );
  const listLoaded =
    Boolean(conversationId) && loadedConversationId === conversationId;
  const listError =
    listErrorState && listErrorState.conversationId === conversationId
      ? listErrorState.error
      : undefined;
  const visibleFiles = listLoaded ? files : [];
  const visibleNonFileArtifacts = listLoaded ? nonFileArtifacts : [];
  const listLoading =
    requestLoading ||
    (enabled && Boolean(conversationId) && !listLoaded && !listError);

  const updateTabsRef = useRef(updateTabs);
  updateTabsRef.current = updateTabs;

  const refreshFiles = useCallback((): Promise<void> => {
    const activeContext = activeContextRef.current;
    if (!activeContext.enabled || !activeContext.conversationId) {
      return Promise.resolve();
    }

    const targetConversationId = activeContext.conversationId;
    const generation = generationRef.current;
    const currentFlight = flightRef.current;
    if (
      currentFlight &&
      currentFlight.conversationId === targetConversationId &&
      currentFlight.generation === generation
    ) {
      return currentFlight.promise;
    }

    setListErrorState(undefined);
    const requestToken = Symbol("workspace-request");

    const requestPromise = (async () => {
      try {
        const response = await runWorkspaceRequest(targetConversationId);
        if (
          generation !== generationRef.current ||
          activeContextRef.current.conversationId !== targetConversationId ||
          !activeContextRef.current.enabled
        ) {
          return;
        }

        setFiles(response.fileArtifacts.records);
        setFileTotal(response.fileArtifacts.page.total);
        setNonFileArtifacts(response.nonFileArtifacts);
        updateTabsRef.current((current) =>
          updateWorkspaceNonFilePages(current, response.nonFileArtifacts),
        );
        setLoadedConversationId(targetConversationId);
        setListErrorState(undefined);
      } catch (error) {
        if (
          generation !== generationRef.current ||
          activeContextRef.current.conversationId !== targetConversationId ||
          !activeContextRef.current.enabled ||
          (error instanceof Error && error.message === "Request was canceled")
        ) {
          return;
        }

        // 保留最后一次成功数据；只有尚无历史数据时，列表区域才展示此错误。
        setListErrorState({
          conversationId: targetConversationId,
          error:
            error instanceof Error
              ? error
              : new Error("Workspace request failed"),
        });
      } finally {
        if (flightRef.current?.token !== requestToken) return;

        flightRef.current = undefined;
        if (
          trailingRefreshRef.current &&
          generation === generationRef.current &&
          activeContextRef.current.conversationId === targetConversationId &&
          activeContextRef.current.enabled
        ) {
          trailingRefreshRef.current = false;
          void refreshFilesRef.current();
        }
      }
    })();

    flightRef.current = {
      conversationId: targetConversationId,
      generation,
      token: requestToken,
      promise: requestPromise,
    };
    return requestPromise;
  }, [runWorkspaceRequest]);

  refreshFilesRef.current = refreshFiles;

  useEffect(() => {
    generationRef.current += 1;
    cancelWorkspaceRequest();
    flightRef.current = undefined;
    trailingRefreshRef.current = false;
    terminalKeysRef.current.clear();
    setFiles([]);
    setNonFileArtifacts([]);
    setFileTotal(0);
    setLoadedConversationId(undefined);
    setSelectedPath(undefined);
    setListErrorState(undefined);

    let effectActive = true;
    if (enabled && conversationId) {
      // Strict Mode 会先清理再重新执行 effect。延后一拍可取消首次调度，
      // 避免真实 useApiRequest 在中间清理时取消请求后永久停在首次加载态。
      void Promise.resolve().then(() => {
        if (effectActive) void refreshFilesRef.current();
      });
    }

    return () => {
      effectActive = false;
      generationRef.current += 1;
      flightRef.current = undefined;
      trailingRefreshRef.current = false;
    };
  }, [cancelWorkspaceRequest, conversationId, enabled]);

  const setTab: WorkspaceControllerValue["setTab"] = (kind) => {
    if (
      (kind === WorkspacePageKind.Subagents && !subagents) ||
      (kind === WorkspacePageKind.GoalHistory && (!goal || readOnly))
    )
      return;
    openTab({ key: kind, kind });
  };
  const showHome = () => activateTab(WorkspacePageKind.Home);
  const showSubagents = () => setTab(WorkspacePageKind.Subagents);
  const selectSubagent = (taskId: string) => {
    if (!subagents?.tasks.some((task) => task.taskId === taskId)) return;
    openTab({
      key: `subagent:${taskId}`,
      kind: WorkspacePageKind.SubagentDetail,
      taskId,
    });
    openWorkspace();
  };
  const openFilePreview = (file: WorkspaceFilePreviewInput) => {
    const sourceConversationId = file.conversationId ?? conversationId;
    if (
      !sourceConversationId ||
      (file.fileId !== undefined
        ? !Number.isSafeInteger(file.fileId) || file.fileId <= 0
        : !file.relativePath?.trim())
    )
      return;
    openTab({
      key: file.fileId !== undefined ? `file:${sourceConversationId}:${file.fileId}` : `workspace-path:${sourceConversationId}:${file.relativePath}`,
      kind: WorkspacePageKind.File,
      file: { ...file, conversationId: sourceConversationId },
      refreshToken: 0,
    });
    openWorkspace();
  };
  const selectFile: WorkspaceControllerValue["selectFile"] = (file) => {
    setSelectedPath(file.relativePath);
    openFilePreview({
      fileName: file.fileName,
      relativePath: file.relativePath,
      mimeType: file.mimeType ?? undefined,
    });
  };
  const openArtifact = (artifact: Artifacts, sourceConversationId?: string) => {
    openFilePreview({ ...artifact, conversationId: sourceConversationId });
  };
  const openNonFileArtifact = (artifact: WorkspaceNonFileArtifact) => {
    if (!getWorkspaceNonFileArtifactPreviewUrl(artifact)) return;
    openTab({
      key: `non-file:${artifact.kind}:${artifact.artifactId}`,
      kind: WorkspacePageKind.NonFileArtifact,
      artifact,
      refreshToken: 0,
    });
    openWorkspace();
  };
  const refreshCurrentPreview = () =>
    updateTabs((current) => ({
      ...current,
      tabs: current.tabs.map((page) =>
        page.key === current.activeTabKey &&
        (page.kind === WorkspacePageKind.File ||
          page.kind === WorkspacePageKind.NonFileArtifact)
          ? { ...page, refreshToken: page.refreshToken + 1 }
          : page,
      ),
    }));

  terminalWorkspaceArtifactsEvent.useSubscription((event) => {
    if (event.conversationId !== conversationId) return;

    const terminalKey = [
      event.conversationId,
      event.messageId,
      event.terminalType,
      event.artifacts.map((artifact) => artifact.fileId).join(","),
      event.nonFileArtifacts
        .map((artifact) => `${artifact.artifactId}@${artifact.lastUpdateTime}`)
        .join(","),
    ].join(":");
    if (terminalKeysRef.current.has(terminalKey)) return;
    terminalKeysRef.current.add(terminalKey);

    if (event.artifacts.length > 0 || event.nonFileArtifacts.length > 0) {
      const currentFlight = flightRef.current;
      if (
        currentFlight &&
        currentFlight.conversationId === event.conversationId &&
        currentFlight.generation === generationRef.current
      ) {
        trailingRefreshRef.current = true;
      } else {
        void refreshFilesRef.current();
      }
    }

    updateTabs((current) =>
      updateWorkspaceNonFilePages(current, event.nonFileArtifacts),
    );
  });

  const value: WorkspaceControllerValue = {
    files: visibleFiles,
    nonFileArtifacts: visibleNonFileArtifacts,
    itemCount: listLoaded ? fileTotal + nonFileArtifacts.length : 0,
    listLoading,
    listLoaded,
    listError,
    selectedPath,
    tabs,
    activeTabKey,
    workspaceOpen,
    openWorkspace,
    closeWorkspace,
    openFilePreview,
    activateTab,
    closeTab,
    showHome,
    refreshFiles,
    subagents,
    goal: readOnly ? undefined : goal,
    readOnly,
    setTab,
    showSubagents,
    selectSubagent,
    selectFile,
    openArtifact,
    openNonFileArtifact,
    refreshCurrentPreview,
  };

  return (
    <WorkspaceControllerContext.Provider value={value}>
      {children}
    </WorkspaceControllerContext.Provider>
  );
}

/** 获取可选的工作区状态，供可脱离 AgentsChat 单独使用的消息组件回退为 Sheet。 */
export function useOptionalWorkspaceController(): WorkspaceControllerValue | null {
  return useContext(WorkspaceControllerContext);
}

export function useWorkspaceController(): WorkspaceControllerValue {
  const value = useOptionalWorkspaceController();
  if (!value) {
    throw new Error(
      "useWorkspaceController must be used inside a WorkspaceControllerProvider",
    );
  }
  return value;
}
