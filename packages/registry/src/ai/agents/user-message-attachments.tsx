"use client";

import {ImageOff} from "lucide-react";
import {useAgentMessages} from "../../i18n/runtime";
import React, {useState} from "react";
import {Button} from "../../ui/components/button";
import {
  Attachment,
  type AttachmentData,
  AttachmentHoverCard,
  AttachmentHoverCardContent,
  AttachmentHoverCardTrigger,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
  useAttachmentsContext,
} from "../components/attachments";
import type {MediaAttachment} from "../hooks/use-chat/schema";
import {useFileBlobUrlRequest} from "../hooks/use-chat/use-file-preview-url-callback";
import {useAiChatContext} from "./context";
import {FilePreviewSheet} from "./file-preview-sheet";

export type UserMessageAttachmentsProps = {
  attachments: MediaAttachment[];
};

interface SelectedFile {
  fileId: number
  fileName?: string
  mimeType?: string
}

/** 将 schema Attachment 转换为 attachments.tsx 的 AttachmentData */
function toAttachmentData(a: MediaAttachment, url = ""): AttachmentData {
  return {
    type: "file" as const,
    id: String(a.fileId),
    mediaType: a.mimeType,
    filename: a.fileName,
    url,
  };
}

/**
 * 用户消息附件渲染组件
 * 纯图片显示缩略图网格，混合附件统一显示图标和文件名；图片保留悬浮预览，点击附件打开 Sheet
 */
export function UserMessageAttachments({attachments}: UserMessageAttachmentsProps) {
  const t = useAgentMessages("user-message-attachment-list");
  const [isExpanded, setIsExpanded] = useState(false);
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  if (attachments.length === 0) return null;

  const variant = attachments.every(a => a.mimeType.startsWith("image/")) ? "grid" : "inline";
  const visibleAttachments = isExpanded ? attachments : attachments.slice(0, 5);

  const handleSelect = (a: MediaAttachment) => {
    setSelected({fileId: a.fileId, fileName: a.fileName, mimeType: a.mimeType})
  }

  return (
    <div className="flex flex-col gap-2">
      <Attachments variant={variant}>
        {visibleAttachments.map(a => (
          a.mimeType.startsWith("image/") ? (
            <UserImageAttachment
              key={a.fileId}
              attachment={a}
              onPreview={handleSelect}
            />
          ) : (
            <UserFileAttachment
              key={a.fileId}
              attachment={a}
              onPreview={handleSelect}
            />
          )
        ))}
      </Attachments>
      {attachments.length > 5 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-end"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded(expanded => !expanded)}
        >
          {isExpanded ? t.collapse : t.expandAll({count: attachments.length})}
        </Button>
      )}
      <FilePreviewSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        fileId={selected?.fileId}
        fileName={selected?.fileName}
        mimeType={selected?.mimeType}
      />
    </div>
  );
}

/**
 * 图片附件：悬浮预览 + 点击打开 Sheet 全功能预览
 */
function UserImageAttachment({
  attachment,
  onPreview,
}: {
  attachment: MediaAttachment;
  onPreview: (a: MediaAttachment) => void;
}) {
  const {conversationId, httpClient} = useAiChatContext();
  const {variant} = useAttachmentsContext();

  if (!conversationId) {
    return variant === "inline" ? <UserFileAttachment attachment={attachment} onPreview={onPreview}/> : null;
  }

  return (
    <UserImageAttachmentContent
      key={`${conversationId}-${attachment.fileId}`}
      attachment={attachment}
      conversationId={conversationId}
      httpClient={httpClient}
      onPreview={onPreview}
    />
  );
}

function UserImageAttachmentContent({
  attachment,
  conversationId,
  httpClient,
  onPreview,
}: {
  attachment: MediaAttachment;
  conversationId: string;
  httpClient: ReturnType<typeof useAiChatContext>["httpClient"];
  onPreview: (a: MediaAttachment) => void;
}) {
  const t = useAgentMessages("user-message-attachments");
  const {variant} = useAttachmentsContext();
  const [hasRequestedPreview, setHasRequestedPreview] = useState(variant === "grid");
  const {
    data: imageUrl,
    loading,
    error,
  } = useFileBlobUrlRequest(httpClient, conversationId, attachment.fileId, {
    ready: variant === "grid" || hasRequestedPreview,
  })

  if (error && variant === "grid") {
    return (
      <div className="size-full min-h-[120px] flex flex-col items-center justify-center bg-muted/50 rounded-md gap-2">
        <ImageOff size={20} className="text-muted-foreground"/>
        <span className="text-xs text-muted-foreground">{t.imageLoadError}</span>
      </div>
    )
  }

  if (loading && variant === "grid") {
    return (
      <div className="size-full min-h-[120px] flex items-center justify-center bg-muted/50 rounded-md">
        <span className="text-xs text-muted-foreground">{t.loading}</span>
      </div>
    )
  }

  const data = toAttachmentData(attachment, variant === "grid" ? imageUrl ?? "" : "");

  return (
    <AttachmentHoverCard onOpenChange={(open) => {
      if (open) setHasRequestedPreview(true);
    }}>
      <AttachmentHoverCardTrigger>
        <Attachment
          data={data}
          className="cursor-pointer"
          onClick={() => onPreview(attachment)}
        >
          <AttachmentPreview/>
          {variant === "inline" && <AttachmentInfo/>}
        </Attachment>
      </AttachmentHoverCardTrigger>
      <AttachmentHoverCardContent>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={attachment.fileName}
            className="max-w-[300px] max-h-[300px] rounded object-contain"
          />
        ) : (
          <div className="flex h-24 w-40 items-center justify-center text-xs text-muted-foreground">
            {error ? t.imageLoadError : t.loading}
          </div>
        )}
      </AttachmentHoverCardContent>
    </AttachmentHoverCard>
  );
}

/**
 * 文件附件：点击打开 Sheet 全功能预览
 */
function UserFileAttachment({
  attachment,
  onPreview,
}: {
  attachment: MediaAttachment;
  onPreview: (a: MediaAttachment) => void;
}) {
  const data = toAttachmentData(attachment);

  return (
    <Attachment
      data={data}
      className="cursor-pointer"
      onClick={() => onPreview(attachment)}
    >
      <AttachmentPreview/>
      <AttachmentInfo/>
    </Attachment>
  );
}
