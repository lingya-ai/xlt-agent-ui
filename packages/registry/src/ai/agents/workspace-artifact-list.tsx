"use client";

import { type ReactNode } from "react";
import { CircleAlert, FileIcon, Globe2, ImageIcon } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../ui/components/alert";
import { Badge } from "../../ui/components/badge";
import { Button } from "../../ui/components/button";
import { ScrollArea } from "../../ui/components/scroll-area";
import { Skeleton } from "../../ui/components/skeleton";
import { cn } from "../../ui/lib/utils";
import { FileTreeActions, FileTreeFile } from "../components/file-tree";
import type {
  WorkspaceFile,
  WorkspaceNonFileArtifact,
} from "../hooks/use-chat/use-workspace-files";
import { WorkspaceNonFileArtifactKindEnum } from "../hooks/use-chat/use-workspace-files";
import { WorkspaceFileTree } from "./workspace-file-tree";
import { getWorkspaceNonFileArtifactPreviewUrl } from "./workspace-non-file-artifact-utils";
import { HtmlPageWebPreview } from "./html_page_web_preview";

interface WorkspaceArtifactListProps {
  files: WorkspaceFile[];
  nonFileArtifacts: WorkspaceNonFileArtifact[];
  listLoading: boolean;
  listLoaded: boolean;
  listError?: Error;
  selectedPath?: string;
  fileArtifactsLabel: ReactNode;
  nonFileArtifactsLabel: ReactNode;
  loadingLabel: ReactNode;
  loadErrorLabel: ReactNode;
  retryLabel: ReactNode;
  emptyLabel: ReactNode;
  getFileTitle: (file: WorkspaceFile) => string;
  renderFileMeta: (file: WorkspaceFile) => ReactNode;
  renderFileActions?: (file: WorkspaceFile) => ReactNode;
  getNonFileArtifactKindLabel: (
    artifact: WorkspaceNonFileArtifact,
  ) => ReactNode;
  onSelectFile: (file: WorkspaceFile) => void;
  onOpenNonFileArtifact: (artifact: WorkspaceNonFileArtifact) => void;
  onRetry: () => void;
}

interface WorkspaceNonFileArtifactPreviewProps {
  artifact: WorkspaceNonFileArtifact;
  refreshToken: number;
}

interface WorkspaceFileArtifactRowProps {
  file: WorkspaceFile;
  selected: boolean;
  title: string;
  meta: ReactNode;
  actions?: ReactNode;
}

interface WorkspaceNonFileArtifactRowProps {
  artifact: WorkspaceNonFileArtifact;
  kindLabel: ReactNode;
  onOpen: (artifact: WorkspaceNonFileArtifact) => void;
}

const workspaceSkeletonRows = [0, 1, 2];

function WorkspaceArtifactListSkeleton({
  loadingLabel,
}: {
  loadingLabel: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3"
      data-testid="workspace-list-skeleton"
    >
      <span className="sr-only">{loadingLabel}</span>
      <Skeleton className="h-3 w-16" />
      <div className="flex flex-col gap-1">
        {workspaceSkeletonRows.map((row) => (
          <div
            key={row}
            className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5"
          >
            <Skeleton className="size-8 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceFileArtifactRow({
  file,
  selected,
  title,
  meta,
  actions,
}: WorkspaceFileArtifactRowProps) {
  return (
    <FileTreeFile
      path={file.relativePath}
      name={file.fileName}
      title={title}
      className={cn(
        "group gap-3 border border-transparent px-3 py-2.5 transition-colors duration-150 hover:bg-muted motion-reduce:transition-none",
        selected && "border-border bg-muted text-foreground",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {file.mimeType?.startsWith("image/") ? (
          <ImageIcon className="size-3.5" />
        ) : (
          <FileIcon className="size-3.5" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium">{file.fileName}</span>
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      {actions ? <FileTreeActions>{actions}</FileTreeActions> : null}
    </FileTreeFile>
  );
}

function WorkspaceNonFileArtifactRow({
  artifact,
  kindLabel,
  onOpen,
}: WorkspaceNonFileArtifactRowProps) {
  const previewUrl = getWorkspaceNonFileArtifactPreviewUrl(artifact);

  return (
    <li>
      <button
        type="button"
        title={artifact.description}
        disabled={!previewUrl}
        onClick={() => onOpen(artifact)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors duration-150 enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Globe2 className="size-3.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">{artifact.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {artifact.description}
          </span>
        </span>
        <Badge variant="secondary" className="shrink-0 font-normal">
          {kindLabel}
        </Badge>
      </button>
    </li>
  );
}

/** 工作区文件和非文件制品的统一列表。 */
export function WorkspaceArtifactList({
  files,
  nonFileArtifacts,
  listLoading,
  listLoaded,
  listError,
  selectedPath,
  fileArtifactsLabel,
  nonFileArtifactsLabel,
  loadingLabel,
  loadErrorLabel,
  retryLabel,
  emptyLabel,
  getFileTitle,
  renderFileMeta,
  renderFileActions,
  getNonFileArtifactKindLabel,
  onSelectFile,
  onOpenNonFileArtifact,
  onRetry,
}: WorkspaceArtifactListProps) {
  const itemCount = files.length + nonFileArtifacts.length;

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-6 p-4">
        {!listLoaded && listLoading ? (
          <WorkspaceArtifactListSkeleton loadingLabel={loadingLabel} />
        ) : !listLoaded && listError ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{loadErrorLabel}</AlertTitle>
            <AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                {retryLabel}
              </Button>
            </AlertDescription>
          </Alert>
        ) : itemCount > 0 ? (
          <>
            {files.length > 0 && (
              <section>
                <h3 className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                  {fileArtifactsLabel}
                </h3>
                <WorkspaceFileTree
                  files={files}
                  selectedPath={selectedPath}
                  onSelect={onSelectFile}
                  className="border-border bg-card font-sans"
                  renderFile={(file) => (
                    <WorkspaceFileArtifactRow
                      file={file}
                      selected={selectedPath === file.relativePath}
                      title={getFileTitle(file)}
                      meta={renderFileMeta(file)}
                      actions={renderFileActions?.(file)}
                    />
                  )}
                />
              </section>
            )}
            {nonFileArtifacts.length > 0 && (
              <section>
                <h3 className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                  {nonFileArtifactsLabel}
                </h3>
                <ul className="flex flex-col gap-1">
                  {nonFileArtifacts.map((artifact) => (
                    <WorkspaceNonFileArtifactRow
                      key={artifact.artifactId}
                      artifact={artifact}
                      kindLabel={getNonFileArtifactKindLabel(artifact)}
                      onOpen={onOpenNonFileArtifact}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

/** 根据非文件制品类型渲染预览内容。 */
export function WorkspaceNonFileArtifactPreview({
  artifact,
  refreshToken,
}: WorkspaceNonFileArtifactPreviewProps) {
  switch (artifact.kind) {
    case WorkspaceNonFileArtifactKindEnum.HTML_PAGE: {
      return (
        <HtmlPageWebPreview artifact={artifact} refreshToken={refreshToken} />
      );
    }
    default:
      return null;
  }
}
