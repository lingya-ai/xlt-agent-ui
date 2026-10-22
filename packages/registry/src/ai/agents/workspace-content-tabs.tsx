"use client";

import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { useSize } from "ahooks";
import {
  Compass,
  FileIcon,
  FolderOpen,
  GitBranch,
  Globe2,
  History,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { formatFileSize } from "../../file-preview/utils/format-size";
import { Badge } from "../../ui/components/badge";
import { Button } from "../../ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "../../ui/components/empty";
import { ScrollArea } from "../../ui/components/scroll-area";
import { Skeleton } from "../../ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../ui/components/tabs";
import { cn } from "../../ui/lib/utils";
import { WorkspaceNonFileArtifactKindEnum } from "../hooks/use-chat/workspace-non-file-artifact-schema";
import { useAiChatContextEvent } from "./events";
import { FilePreviewContent } from "./file-preview-sheet";
import {
  WorkspaceArtifactList,
  WorkspaceNonFileArtifactPreview,
} from "./workspace-artifact-list";
import { useWorkspaceController } from "./workspace-controller";
import { WorkspaceFileDownloadAction } from "./workspace-file-download-action";
import { workspaceFilePreviewers } from "./workspace-file-previewers";
import { WorkspaceStart } from "./workspace-start";
import { WorkspacePageKind, type WorkspacePage } from "./workspace-tabs-state";

const WorkspaceSubagents = lazy(() =>
  import("./workspace-subagents").then((module) => ({
    default: module.WorkspaceSubagents,
  })),
);
const WorkspaceSubagentDetail = lazy(() =>
  import("./workspace-subagent-detail").then((module) => ({
    default: module.WorkspaceSubagentDetail,
  })),
);
const AgentGoalDetails = lazy(() =>
  import("./agent-goal-details").then((module) => ({
    default: module.AgentGoalDetails,
  })),
);

interface WorkspaceContentTabsProps {
  onClose?: () => void;
}

/** 分栏与抽屉共用的标签管理，仅挂载当前页面的重型内容。 */
export function WorkspaceContentTabs({ onClose }: WorkspaceContentTabsProps) {
  const t = useAgentMessages("workspace-content-tabs");
  const controller = useWorkspaceController();
  const { conversationId } = useAiChatContextEvent();
  const {
    tabs,
    activeTabKey,
    activateTab,
    closeTab,
    showHome,
    closeWorkspace,
    files,
    subagents,
    goal,
  } = controller;
  const [toolbarContainer, setToolbarContainer] =
    useState<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const panelSize = useSize(panel);
  const tabListRef = useRef<HTMLDivElement>(null);
  const focusAfterClose = useRef(false);
  const active = tabs.find((page) => page.key === activeTabKey) ?? tabs[0];
  useLayoutEffect(() => {
    const trigger = tabListRef.current?.querySelector<HTMLElement>(
      '[data-state="active"]',
    );
    const viewport = tabListRef.current?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    // 仅移动标签栏，避免 scrollIntoView 连带滚动聊天或抽屉的祖先容器。
    const tab = trigger?.parentElement;
    if (tab && viewport) {
      const tabBounds = tab.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      if (tabBounds.left < viewportBounds.left) {
        viewport.scrollLeft += tabBounds.left - viewportBounds.left;
      } else if (tabBounds.right > viewportBounds.right) {
        viewport.scrollLeft += tabBounds.right - viewportBounds.right;
      }
    }
    if (focusAfterClose.current) {
      trigger?.focus({ preventScroll: true });
      focusAfterClose.current = false;
    }
  }, [activeTabKey, tabs.length, panelSize?.width]);
  const handleCloseTab = (key: string) => {
    focusAfterClose.current = true;
    closeTab(key);
  };
  const getTitle = (page: WorkspacePage): string => {
    switch (page.kind) {
      case WorkspacePageKind.Home:
        return t.home.value;
      case WorkspacePageKind.Artifacts:
        return t.artifacts.value;
      case WorkspacePageKind.Subagents:
        return t.subagents.value;
      case WorkspacePageKind.GoalHistory:
        return t.goalHistory.value;
      case WorkspacePageKind.File:
        return page.file.fileName ?? t.file.value;
      case WorkspacePageKind.NonFileArtifact:
        return page.artifact.title;
      case WorkspacePageKind.SubagentDetail:
        return (
          subagents?.tasks.find((task) => task.taskId === page.taskId)
            ?.description ?? t.subagents.value
        );
    }
  };
  const getIcon = (page: WorkspacePage) => {
    switch (page.kind) {
      case WorkspacePageKind.Home:
        return Compass;
      case WorkspacePageKind.Artifacts:
        return FolderOpen;
      case WorkspacePageKind.Subagents:
      case WorkspacePageKind.SubagentDetail:
        return GitBranch;
      case WorkspacePageKind.GoalHistory:
        return History;
      case WorkspacePageKind.NonFileArtifact:
        return Globe2;
      case WorkspacePageKind.File:
        return FileIcon;
    }
  };
  const preview =
    active?.kind === WorkspacePageKind.File ||
    active?.kind === WorkspacePageKind.NonFileArtifact;
  const activeFile =
    active?.kind === WorkspacePageKind.File ? active.file : undefined;
  const currentFile =
    activeFile?.relativePath && controller.listLoaded
      ? files.find((file) => file.relativePath === activeFile.relativePath)
      : undefined;
  const version = currentFile && activeFile?.fileId === undefined ? t.currentVersion : undefined;
  const renderContent = () => {
    if (!active) return null;
    switch (active.kind) {
      case WorkspacePageKind.Home:
        return <WorkspaceStart />;
      case WorkspacePageKind.Artifacts:
        return (
          <WorkspaceArtifactList
            files={files}
            nonFileArtifacts={controller.nonFileArtifacts}
            listLoading={controller.listLoading}
            listLoaded={controller.listLoaded}
            listError={controller.listError}
            selectedPath={controller.selectedPath}
            fileArtifactsLabel={t.fileArtifacts}
            nonFileArtifactsLabel={t.nonFileArtifacts}
            loadingLabel={t.loading}
            loadErrorLabel={t.loadError}
            retryLabel={t.retry}
            emptyLabel={t.noFiles}
            getFileTitle={(file) => file.relativePath}
            renderFileMeta={(file) => formatFileSize(file.size)}
            getNonFileArtifactKindLabel={(artifact) =>
              artifact.kind === WorkspaceNonFileArtifactKindEnum.HTML_PAGE
                ? t.htmlPage
                : artifact.kind
            }
            renderFileActions={(file) => (
              <WorkspaceFileDownloadAction
                file={file}
                downloadLabel={t.download.value}
                downloadErrorLabel={t.downloadError.value}
              />
            )}
            onSelectFile={controller.selectFile}
            onOpenNonFileArtifact={controller.openNonFileArtifact}
            onRetry={() => void controller.refreshFiles()}
          />
        );
      case WorkspacePageKind.Subagents:
        return subagents ? <WorkspaceSubagents /> : null;
      case WorkspacePageKind.GoalHistory:
        return goal ? (
          <AgentGoalDetails
            controller={goal.controller}
            config={goal.config}
            conversationId={conversationId}
            open
            embedded
            historyOnly
          />
        ) : null;
      case WorkspacePageKind.SubagentDetail: {
        const task = subagents?.tasks.find(
          (item) => item.taskId === active.taskId,
        );
        return task ? (
          <WorkspaceSubagentDetail task={task} />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t.taskUnavailable}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        );
      }
      case WorkspacePageKind.NonFileArtifact:
        return (
          <WorkspaceNonFileArtifactPreview
            artifact={active.artifact}
            refreshToken={active.refreshToken}
          />
        );
      case WorkspacePageKind.File:
        return (
          <FilePreviewContent
            fileId={active.file.fileId}
            relativePath={active.file.relativePath ?? undefined}
            conversationId={active.file.conversationId}
            fileName={active.file.fileName}
            mimeType={active.file.mimeType}
            previewers={workspaceFilePreviewers}
            toolbarContainer={toolbarContainer}
            fullscreenTarget={panel}
            loadKey={active.key + ":" + active.refreshToken}
          />
        );
    }
  };
  return (
    <div
      ref={setPanel}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <Tabs
        value={activeTabKey}
        onValueChange={activateTab}
        activationMode="manual"
        className="min-h-0 min-w-0 flex-1 gap-0"
      >
        <div className="flex h-12 min-w-0 shrink-0 items-center gap-1 border-b bg-muted/30 px-2">
          <ScrollArea
            horizontalScrollbar
            className="h-full min-w-0 flex-1 pt-2"
          >
            <TabsList
              ref={tabListRef}
              aria-label={t.tabsLabel.value}
              className="h-10 items-stretch justify-start gap-1 rounded-none bg-transparent p-0"
            >
              {tabs.map((page) => {
                const title = getTitle(page);
                const Icon = getIcon(page);
                return (
                  <div
                    key={page.key}
                    className={cn(
                      "group/tab flex h-full min-w-0 shrink-0 items-center rounded-t-lg border border-b-0 border-transparent transition-colors duration-150 motion-reduce:transition-none",
                      page.key === activeTabKey
                        ? "border-border bg-background text-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <TabsTrigger
                      value={page.key}
                      title={
                        page.kind === WorkspacePageKind.File
                          ? (page.file.relativePath ?? title)
                          : title
                      }
                      className="h-full min-w-0 max-w-48 flex-none cursor-pointer justify-start rounded-none border-0 px-3 font-normal text-inherit hover:text-foreground focus-visible:ring-inset data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                      onKeyDown={(event) => {
                        if (
                          event.key === "Delete" &&
                          page.kind !== WorkspacePageKind.Home
                        ) {
                          event.preventDefault();
                          handleCloseTab(page.key);
                        }
                      }}
                    >
                      <Icon aria-hidden="true" />
                      <span className="truncate">{title}</span>
                    </TabsTrigger>
                    {page.kind !== WorkspacePageKind.Home && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="mr-1 size-6 shrink-0 cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground motion-reduce:transition-none"
                        aria-label={t.closeTab({ title }).value}
                        onClick={() => handleCloseTab(page.key)}
                      >
                        <X data-icon="inline-start" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </TabsList>
          </ScrollArea>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 cursor-pointer"
            aria-label={t.home.value}
            title={t.home.value}
            onClick={showHome}
          >
            <Plus data-icon="inline-start" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 cursor-pointer"
            aria-label={t.closeWorkspace.value}
            title={t.closeWorkspace.value}
            onClick={onClose ?? closeWorkspace}
          >
            <X data-icon="inline-start" />
          </Button>
        </div>
        {(active?.kind === WorkspacePageKind.File ||
          active?.kind === WorkspacePageKind.Artifacts) && (
          <div className="flex h-12 min-w-0 shrink-0 items-center gap-2 border-b px-4">
            <span
              className="min-w-0 flex-1 truncate text-sm"
              title={
                active?.kind === WorkspacePageKind.File
                  ? active.file.relativePath ?? undefined
                  : undefined
              }
            >
              {active ? getTitle(active) : null}
            </span>
            {version && <Badge variant="secondary">{version}</Badge>}
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label={
                preview ? t.refreshPreview.value : t.refreshFiles.value
              }
              disabled={!preview && controller.listLoading}
              onClick={() =>
                preview
                  ? controller.refreshCurrentPreview()
                  : void controller.refreshFiles()
              }
            >
              <RefreshCw
                data-icon="inline-start"
                className={cn(
                  !preview &&
                    controller.listLoading &&
                    "animate-spin motion-reduce:animate-none",
                )}
              />
            </Button>
            {active?.kind === WorkspacePageKind.File && (
              <div
                ref={setToolbarContainer}
                className="flex min-w-0 items-center overflow-x-auto"
              />
            )}
          </div>
        )}
        <TabsContent
          key={activeTabKey}
          value={activeTabKey}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          <Suspense
            fallback={
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            }
          >
            {renderContent()}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
