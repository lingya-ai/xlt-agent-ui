"use client";

import React, { useCallback, useState } from "react";
import { DownloadIcon, FileIcon, Globe2, PackageIcon } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { type Artifacts } from "../hooks/use-chat/schema";
import { useFilePreviewUrlCallback } from "../hooks/use-chat/use-file-preview-url-callback";
import { useAiChatContext } from "./context";
import { FilePreviewSheet } from "./file-preview-sheet";
import { formatFileSize } from "../../file-preview/utils/format-size";
import { Button } from "../../ui/components/button";
import { cn } from "../../ui/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../ui/components/sheet";
import { toast } from "../../ui/components/sonner";
import {
  type WorkspaceNonFileArtifact,
  WorkspaceNonFileArtifactKindEnum,
} from "../hooks/use-chat/use-workspace-files";
import { WorkspaceNonFileArtifactPreview } from "./workspace-artifact-list";
import { useOptionalWorkspaceController } from "./workspace-controller";
import { getWorkspaceNonFileArtifactPreviewUrl } from "./workspace-non-file-artifact-utils";

export type AssistantMessageArtifactsProps = {
  artifacts: Artifacts[];
  nonFileArtifacts?: WorkspaceNonFileArtifact[];
  /** 当前消息所属会话，用于历史文件制品的预览和下载。 */
  conversationId?: string;
};

/**
 * 从制品相对路径中提取所在目录，根目录统一显示为 `/`。
 */
function getArtifactDirectory(relativePath: string | null | undefined): string {
  if (!relativePath) return "/";

  const normalizedPath = relativePath.replaceAll("\\", "/");
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  return lastSlashIndex > 0 ? normalizedPath.slice(0, lastSlashIndex + 1) : "/";
}

/**
 * Assistant 消息制品渲染组件
 *
 * 以独立卡片形式呈现智能体的产出：
 * - Header：图标 + 标题 + 副标题 + 计数徽章
 * - 文件制品：统一使用列表布局，含文件名、所在目录、大小、下载按钮
 * - 非文件制品：列表布局，并复用工作区预览逻辑
 */
export function AssistantMessageArtifacts({
  artifacts,
  nonFileArtifacts = [],
  conversationId,
}: AssistantMessageArtifactsProps) {
  const [preview, setPreview] = useState<{
    open: boolean;
    fileId?: number;
    fileName?: string;
    mimeType?: string;
  }>({ open: false });
  const [nonFilePreview, setNonFilePreview] = useState<{
    open: boolean;
    artifact?: WorkspaceNonFileArtifact;
    refreshToken: number;
  }>({ open: false, refreshToken: 0 });
  const workspaceController = useOptionalWorkspaceController();

  const handleOpen = useCallback(
    (artifact: Artifacts) => {
      if (workspaceController) {
        workspaceController.openArtifact(artifact, conversationId);
        return;
      }

      setPreview({
        open: true,
        fileId: artifact.fileId,
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
      });
    },
    [conversationId, workspaceController],
  );

  const handleOpenNonFileArtifact = useCallback(
    (artifact: WorkspaceNonFileArtifact) => {
      if (!getWorkspaceNonFileArtifactPreviewUrl(artifact)) return;

      if (workspaceController) {
        workspaceController.openNonFileArtifact(artifact);
        return;
      }

      setNonFilePreview((previous) => ({
        open: true,
        artifact,
        refreshToken: previous.refreshToken + 1,
      }));
    },
    [workspaceController],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    setPreview((prev) => ({ ...prev, open }));
  }, []);

  const handleNonFileOpenChange = useCallback((open: boolean) => {
    setNonFilePreview((previous) => ({ ...previous, open }));
  }, []);

  if (artifacts.length === 0 && nonFileArtifacts.length === 0) return null;

  const totalCount = artifacts.length + nonFileArtifacts.length;

  return (
    <>
      <AssistantArtifactsCard totalCount={totalCount}>
        {artifacts.length > 0 && (
          <ul className="flex flex-col gap-1">
            {artifacts.map((a) => (
              <ArtifactFileRow
                key={a.fileId}
                attachment={a}
                conversationId={conversationId}
                onPreview={handleOpen}
              />
            ))}
          </ul>
        )}
        {nonFileArtifacts.length > 0 && (
          <ul className="flex flex-col gap-1">
            {nonFileArtifacts.map((artifact) => (
              <ArtifactNonFileRow
                key={artifact.artifactId}
                artifact={artifact}
                onPreview={handleOpenNonFileArtifact}
              />
            ))}
          </ul>
        )}
      </AssistantArtifactsCard>
      <FilePreviewSheet
        open={preview.open}
        onOpenChange={handleOpenChange}
        fileId={preview.fileId}
        conversationId={conversationId}
        fileName={preview.fileName}
        mimeType={preview.mimeType}
      />
      <Sheet open={nonFilePreview.open} onOpenChange={handleNonFileOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-none flex-col gap-0 p-0 sm:w-[90vw] sm:max-w-[90vw] lg:w-[50vw] lg:min-w-[800px]"
        >
          <SheetHeader className="border-b border-border/60 px-4 py-3">
            <SheetTitle>{nonFilePreview.artifact?.title}</SheetTitle>
          </SheetHeader>
          {nonFilePreview.artifact && (
            <WorkspaceNonFileArtifactPreview
              artifact={nonFilePreview.artifact}
              refreshToken={nonFilePreview.refreshToken}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * 非文件制品：复用工作区非文件制品的可预览性判断和预览入口。
 */
function ArtifactNonFileRow({
  artifact,
  onPreview,
}: {
  artifact: WorkspaceNonFileArtifact;
  onPreview: (artifact: WorkspaceNonFileArtifact) => void;
}) {
  const t = useAgentMessages("agents-chat-message");
  const previewUrl = getWorkspaceNonFileArtifactPreviewUrl(artifact);
  const kindLabel =
    artifact.kind === WorkspaceNonFileArtifactKindEnum.HTML_PAGE
      ? t.artifactHtmlPage
      : artifact.kind;

  return (
    <li>
      <button
        type="button"
        title={artifact.description}
        disabled={!previewUrl}
        onClick={() => onPreview(artifact)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-left",
          "transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Globe2 className="size-3.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-xs font-medium">{artifact.title}</span>
          <span className="truncate text-[10px] text-muted-foreground">
            {artifact.description}
          </span>
        </span>
        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {kindLabel}
        </span>
      </button>
    </li>
  );
}

/**
 * 制品卡片容器：左侧 accent bar + 渐变背景 + header
 */
function AssistantArtifactsCard({
  totalCount,
  children,
}: {
  totalCount: number;
  children: React.ReactNode;
}) {
  const t = useAgentMessages("agents-chat-message");

  return (
    <section
      className={cn(
        "mt-1 w-full overflow-hidden rounded-lg border border-border",
        "border-l-2 border-l-brand",
        "bg-card",
        "shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-brand">
            <PackageIcon size={12} />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-xs font-medium text-foreground">
              {t.artifactsTitle}
            </span>
            <span className="truncate text-[10px] text-muted-foreground">
              {t.artifactsSubtitle}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-brand-action">
          {t.artifactsCount({ count: totalCount })}
        </span>
      </header>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </section>
  );
}

/**
 * 文件制品：图标 + 文件名 + 所在目录/大小 + 下载按钮，整行点击打开制品预览
 */
function ArtifactFileRow({
  attachment,
  conversationId,
  onPreview,
}: {
  attachment: Artifacts;
  conversationId?: string;
  onPreview: (a: Artifacts) => void;
}) {
  const { httpClient } = useAiChatContext();

  if (!conversationId) return null;

  return (
    <ArtifactFileRowContent
      attachment={attachment}
      conversationId={conversationId}
      httpClient={httpClient}
      onPreview={onPreview}
    />
  );
}

function ArtifactFileRowContent({
  attachment,
  conversationId,
  httpClient,
  onPreview,
}: {
  attachment: Artifacts;
  conversationId: string;
  httpClient: ReturnType<typeof useAiChatContext>["httpClient"];
  onPreview: (a: Artifacts) => void;
}) {
  const t = useAgentMessages("agents-chat-message");
  const [downloading, setDownloading] = useState(false);
  const filePreviewUrlCallback = useFilePreviewUrlCallback(
    httpClient,
    conversationId,
  );

  const handlePreview = useCallback(() => {
    onPreview(attachment);
  }, [onPreview, attachment]);

  const handleDownload = useCallback(
    async (event: React.MouseEvent) => {
      // 阻止冒泡到行点击
      event.stopPropagation();
      setDownloading(true);
      try {
        const { url } = await filePreviewUrlCallback(attachment.fileId);
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = attachment.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      } catch {
        toast.error(t.artifactDownloadFailed);
      } finally {
        setDownloading(false);
      }
    },
    [filePreviewUrlCallback, attachment.fileId, attachment.fileName, t],
  );

  return (
    <li
      onClick={handlePreview}
      title={t.artifactPreviewHint.value}
      className="group flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1.5 transition-colors hover:bg-accent/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
        <FileIcon size={14} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-xs font-medium">
          {attachment.fileName}
        </span>
        <span
          className="truncate text-[10px] text-muted-foreground"
          title={getArtifactDirectory(attachment.relativePath)}
        >
          {getArtifactDirectory(attachment.relativePath)} ·{" "}
          {formatFileSize(attachment.fileSize)}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
        onClick={handleDownload}
        disabled={downloading}
        aria-label={t.artifactDownload.value}
      >
        <DownloadIcon size={14} />
      </Button>
    </li>
  );
}
