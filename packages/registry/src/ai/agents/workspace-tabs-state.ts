import type { WorkspaceNonFileArtifact } from "../hooks/use-chat/use-workspace-files";

/** 工作区可打开的页面类型。 */
export enum WorkspacePageKind {
  Home = "home",
  Artifacts = "artifacts",
  Subagents = "subagents",
  GoalHistory = "goal-history",
  File = "file",
  NonFileArtifact = "non-file-artifact",
  SubagentDetail = "subagent-detail",
}

/** 文件版本预览输入，允许归档结果缺省展示元数据。 */
export type WorkspaceFilePreviewInput = {
  fileId?: number;
  conversationId?: string;
  fileName?: string;
  mimeType?: string;
  relativePath?: string | null;
};

export type WorkspacePage =
  | {
      key: string;
      kind:
        | WorkspacePageKind.Home
        | WorkspacePageKind.Artifacts
        | WorkspacePageKind.Subagents
        | WorkspacePageKind.GoalHistory;
    }
  | {
      key: string;
      kind: WorkspacePageKind.File;
      file: WorkspaceFilePreviewInput;
      refreshToken: number;
    }
  | {
      key: string;
      kind: WorkspacePageKind.NonFileArtifact;
      artifact: WorkspaceNonFileArtifact;
      refreshToken: number;
    }
  | { key: string; kind: WorkspacePageKind.SubagentDetail; taskId: string };

export type WorkspaceTabsState = {
  tabs: WorkspacePage[];
  activeTabKey: string;
};

/** 创建仅包含固定开始页的标签状态。 */
export function createWorkspaceTabsState(): WorkspaceTabsState {
  return {
    tabs: [{ key: WorkspacePageKind.Home, kind: WorkspacePageKind.Home }],
    activeTabKey: WorkspacePageKind.Home,
  };
}

/** 已存在的标签只聚焦并补齐元数据，保留排列顺序和独立刷新标记。 */
export function openWorkspacePage(
  state: WorkspaceTabsState,
  page: WorkspacePage,
): WorkspaceTabsState {
  const existing = state.tabs.find((item) => item.key === page.key);
  const tabs = existing
    ? state.tabs.map((item) => {
        if (item.key !== page.key) return item;
        if (
          item.kind === WorkspacePageKind.File &&
          page.kind === WorkspacePageKind.File
        ) {
          return {
            ...item,
            file: {
              fileId: item.file.fileId,
              conversationId:
                item.file.conversationId ?? page.file.conversationId,
              fileName: item.file.fileName ?? page.file.fileName,
              mimeType: item.file.mimeType ?? page.file.mimeType,
              relativePath: item.file.relativePath ?? page.file.relativePath,
            },
          };
        }
        if (
          item.kind === WorkspacePageKind.NonFileArtifact &&
          page.kind === WorkspacePageKind.NonFileArtifact
        ) {
          if (
            page.artifact.lastUpdateTime.getTime() <=
            item.artifact.lastUpdateTime.getTime()
          )
            return item;
          return {
            ...item,
            artifact: page.artifact,
            refreshToken:
              item.refreshToken +
              Number(
                item.artifact.lastUpdateTime.getTime() !== page.artifact.lastUpdateTime.getTime(),
              ),
          };
        }
        return item;
      })
    : [...state.tabs, page];
  return { tabs, activeTabKey: page.key };
}

/** 关闭活动标签时依次选择右邻、左邻和开始页。 */
export function closeWorkspacePage(
  state: WorkspaceTabsState,
  key: string,
): WorkspaceTabsState {
  if (key === WorkspacePageKind.Home) return state;
  const index = state.tabs.findIndex((page) => page.key === key);
  if (index < 0) return state;
  const tabs = state.tabs.filter((page) => page.key !== key);
  return {
    tabs,
    activeTabKey:
      state.activeTabKey === key
        ? ((tabs[index] ?? tabs[index - 1])?.key ?? WorkspacePageKind.Home)
        : state.activeTabKey,
  };
}

/** 更新已打开的非文件制品，不创建标签或改变当前焦点。 */
export function updateWorkspaceNonFilePages(
  state: WorkspaceTabsState,
  artifacts: WorkspaceNonFileArtifact[],
): WorkspaceTabsState {
  return {
    ...state,
    tabs: state.tabs.map((page) => {
      if (page.kind !== WorkspacePageKind.NonFileArtifact) return page;
      const artifact = artifacts.find(
        (item) =>
          item.artifactId === page.artifact.artifactId &&
          item.kind === page.artifact.kind,
      );
      if (
        !artifact ||
        artifact.lastUpdateTime.getTime() <=
          page.artifact.lastUpdateTime.getTime()
      )
        return page;
      return { ...page, artifact, refreshToken: page.refreshToken + 1 };
    }),
  };
}
