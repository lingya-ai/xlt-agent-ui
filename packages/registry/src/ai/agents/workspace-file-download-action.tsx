"use client";

import { useCallback, useState } from "react";
import { DownloadIcon, Loader2 } from "lucide-react";
import { Button } from "../../ui/components/button";
import { toast } from "../../ui/components/sonner";
import type { WorkspaceFile } from "../hooks/use-chat/use-workspace-files";
import { useWorkspaceFilePreviewUrlCallback } from "../hooks/use-chat/use-workspace-file-preview-url";
import { useAiChatContext } from "./context";
import { useAiChatContextEvent } from "./events";

type WorkspaceFileDownloadActionProps = {
  file: WorkspaceFile;
  downloadLabel: string;
  downloadErrorLabel: string;
};

/** 工作区文件树节点的下载操作。 */
export function WorkspaceFileDownloadAction({
  file,
  downloadLabel,
  downloadErrorLabel,
}: WorkspaceFileDownloadActionProps) {
  const { httpClient } = useAiChatContext();
  const { conversationId } = useAiChatContextEvent();
  const fetchPreviewUrl = useWorkspaceFilePreviewUrlCallback(
    {httpClient},
  );
  const [busy, setBusy] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!conversationId) return;

    setBusy(true);
    try {
      const { url } = await fetchPreviewUrl(conversationId, file.relativePath);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(downloadErrorLabel);
    } finally {
      setBusy(false);
    }
  }, [
    conversationId,
    downloadErrorLabel,
    fetchPreviewUrl,
    file.fileName,
    file.relativePath,
  ]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-7 shrink-0 cursor-pointer opacity-60 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
      onClick={() => void handleDownload()}
      disabled={busy || !conversationId}
      aria-label={downloadLabel}
      title={downloadLabel}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
      ) : (
        <DownloadIcon className="size-3.5" />
      )}
    </Button>
  );
}
