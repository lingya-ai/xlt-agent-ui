"use client";

import type {FileUIPart, SourceDocumentUIPart} from "./types";
import type {ComponentProps, HTMLAttributes, ReactNode} from "react";
import {createContext, useCallback, useContext, useMemo} from "react";
import {Button} from "../../ui/components/button";
import {cn} from "../../ui/lib/utils";
import {HoverCard, HoverCardContent, HoverCardTrigger} from "../../ui/components/hover-card";
import {useAgentMessages} from "../../i18n/runtime";
import {FileTextIcon, GlobeIcon, ImageIcon, Music2Icon, PaperclipIcon, VideoIcon, XIcon,} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type AttachmentData =
  | (FileUIPart & { id: string })
  | (SourceDocumentUIPart & { id: string });

export type AttachmentMediaCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "source"
  | "unknown";

export type AttachmentVariant = "grid" | "inline" | "list";

const mediaCategoryIcons: Record<AttachmentMediaCategory, typeof ImageIcon> = {
  audio: Music2Icon,
  document: FileTextIcon,
  image: ImageIcon,
  source: GlobeIcon,
  unknown: PaperclipIcon,
  video: VideoIcon,
};

// ============================================================================
// Utility Functions
// ============================================================================

export const getMediaCategory = (
  data: AttachmentData
): AttachmentMediaCategory => {
  if (data.type === "source-document") {
    return "source";
  }

  const mediaType = data.mediaType ?? "";

  if (mediaType.startsWith("image/")) {
    return "image";
  }
  if (mediaType.startsWith("video/")) {
    return "video";
  }
  if (mediaType.startsWith("audio/")) {
    return "audio";
  }
  if (mediaType.startsWith("application/") || mediaType.startsWith("text/")) {
    return "document";
  }

  return "unknown";
};

export const getAttachmentLabel = (
  data: AttachmentData,
  labels?: { source?: string; image?: string; attachment?: string }
): string => {
  if (data.type === "source-document") {
    return data.title || data.filename || labels?.source || "Source";
  }

  const category = getMediaCategory(data);
  return data.filename || (category === "image" ? (labels?.image || "Image") : (labels?.attachment || "Attachment"));
};

const renderAttachmentImage = (
  url: string,
  filename: string | undefined,
  isGrid: boolean,
  altFallback = "Image"
) =>
  isGrid ? (
    <img
      alt={filename || altFallback}
      className="size-full object-cover"
      height={96}
      src={url}
      width={96}
    />
  ) : (
    <img
      alt={filename || altFallback}
      className="size-full rounded object-cover"
      height={20}
      src={url}
      width={20}
    />
  );

// ============================================================================
// Contexts
// ============================================================================

interface AttachmentsContextValue {
  variant: AttachmentVariant;
}

const AttachmentsContext = createContext<AttachmentsContextValue | null>(null);

interface AttachmentContextValue {
  data: AttachmentData;
  mediaCategory: AttachmentMediaCategory;
  onRemove?: () => void;
  variant: AttachmentVariant;
}

const AttachmentContext = createContext<AttachmentContextValue | null>(null);

// ============================================================================
// Hooks
// ============================================================================

export const useAttachmentsContext = () =>
  useContext(AttachmentsContext) ?? {variant: "grid" as const};

export const useAttachmentContext = () => {
  const ctx = useContext(AttachmentContext);
  if (!ctx) {
    throw new Error("Attachment components must be used within <Attachment>");
  }
  return ctx;
};

// ============================================================================
// Attachments - Container
// ============================================================================

export type AttachmentsProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AttachmentVariant;
};

export const Attachments = ({
                              variant = "grid",
                              className,
                              children,
                              ...props
                            }: AttachmentsProps) => {
  const contextValue = useMemo(() => ({variant}), [variant]);

  return (
    <AttachmentsContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex items-start",
          variant === "list" ? "flex-col gap-2" : "flex-wrap gap-2",
          variant === "grid" && "ml-auto w-fit",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AttachmentsContext.Provider>
  );
};

// ============================================================================
// Attachment - Item
// ============================================================================

export type AttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: AttachmentData;
  onRemove?: () => void;
};

export const Attachment = ({
                             data,
                             onRemove,
                             className,
                             children,
                             ...props
                           }: AttachmentProps) => {
  const {variant} = useAttachmentsContext();
  const mediaCategory = getMediaCategory(data);

  const contextValue = useMemo<AttachmentContextValue>(
    () => ({data, mediaCategory, onRemove, variant}),
    [data, mediaCategory, onRemove, variant]
  );

  return (
    <AttachmentContext.Provider value={contextValue}>
      <div
        className={cn(
          "group relative",
          variant === "grid" && "size-24 overflow-hidden rounded-lg",
          variant === "inline" && [
            "flex h-8 cursor-pointer select-none items-center gap-1.5",
            "rounded-md border border-border px-1.5",
            "font-medium text-sm transition-all",
            "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
          ],
          variant === "list" && [
            "flex w-full items-center gap-3 rounded-lg border p-3",
            "hover:bg-accent/50",
          ],
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AttachmentContext.Provider>
  );
};

// ============================================================================
// AttachmentPreview - Media preview
// ============================================================================

export type AttachmentPreviewProps = HTMLAttributes<HTMLDivElement> & {
  fallbackIcon?: ReactNode;
};

export const AttachmentPreview = ({
                                    fallbackIcon,
                                    className,
                                    ...props
                                  }: AttachmentPreviewProps) => {
  const {data, mediaCategory, variant} = useAttachmentContext();
  const t = useAgentMessages("attachments");

  const iconSize = variant === "inline" ? "size-3" : "size-4";

  const renderIcon = (Icon: typeof ImageIcon) => (
    <Icon className={cn(iconSize, "text-muted-foreground")}/>
  );

  const renderContent = () => {
    if (mediaCategory === "image" && data.type === "file" && data.url) {
      return renderAttachmentImage(data.url, data.filename, variant === "grid", t.image.value);
    }

    if (mediaCategory === "video" && data.type === "file" && data.url) {
      return <video className="size-full object-cover" muted src={data.url}/>;
    }

    const Icon = mediaCategoryIcons[mediaCategory];
    return fallbackIcon ?? renderIcon(Icon);
  };

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        variant === "grid" && "size-full bg-muted",
        variant === "inline" && "size-5 rounded bg-background",
        variant === "list" && "size-12 rounded bg-muted",
        className
      )}
      {...props}
    >
      {renderContent()}
    </div>
  );
};

// ============================================================================
// AttachmentInfo - Name and type display
// ============================================================================

export type AttachmentInfoProps = HTMLAttributes<HTMLDivElement> & {
  showMediaType?: boolean;
};

export const AttachmentInfo = ({
                                 showMediaType = false,
                                 className,
                                 ...props
                               }: AttachmentInfoProps) => {
  const {data, variant} = useAttachmentContext();
  const t = useAgentMessages("attachments");
  const label = getAttachmentLabel(data, {
    source: t.source.value,
    image: t.image.value,
    attachment: t.attachment.value,
  });

  if (variant === "grid") {
    return null;
  }

  return (
    <div className={cn("min-w-0 flex-1", className)} {...props}>
      <span className="block truncate">{label}</span>
      {showMediaType && data.mediaType && (
        <span className="block truncate text-muted-foreground text-xs">
          {data.mediaType}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// AttachmentRemove - Remove button
// ============================================================================

export type AttachmentRemoveProps = ComponentProps<typeof Button> & {
  label?: string;
};

export const AttachmentRemove = ({
                                   label,
                                   className,
                                   children,
                                   ...props
                                 }: AttachmentRemoveProps) => {
  const {onRemove, variant} = useAttachmentContext();
  const t = useAgentMessages("attachments");
  const resolvedLabel = label ?? t.remove.value;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  if (!onRemove) {
    return null;
  }

  return (
    <Button
      aria-label={resolvedLabel}
      className={cn(
        variant === "grid" && [
          "absolute top-2 right-2 size-6 rounded-full p-0",
          "bg-background/80 backdrop-blur-sm",
          "opacity-0 transition-opacity group-hover:opacity-100",
          "hover:bg-background",
          "[&>svg]:size-3",
        ],
        variant === "inline" && [
          "size-5 rounded p-0",
          "opacity-0 transition-opacity group-hover:opacity-100",
          "[&>svg]:size-2.5",
        ],
        variant === "list" && ["size-8 shrink-0 rounded p-0", "[&>svg]:size-4"],
        className
      )}
      onClick={handleClick}
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <XIcon/>}
      <span className="sr-only">{resolvedLabel}</span>
    </Button>
  );
};

// ============================================================================
// AttachmentHoverCard - Hover preview
// ============================================================================

export type AttachmentHoverCardProps = ComponentProps<typeof HoverCard>;

export const AttachmentHoverCard = ({
                                      openDelay = 0,
                                      closeDelay = 0,
                                      ...props
                                    }: AttachmentHoverCardProps) => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);

export type AttachmentHoverCardTriggerProps = ComponentProps<
  typeof HoverCardTrigger
>;

export const AttachmentHoverCardTrigger = (
  props: AttachmentHoverCardTriggerProps
) => <HoverCardTrigger {...props} />;

export type AttachmentHoverCardContentProps = ComponentProps<
  typeof HoverCardContent
>;

export const AttachmentHoverCardContent = ({
                                             align = "start",
                                             className,
                                             ...props
                                           }: AttachmentHoverCardContentProps) => (
  <HoverCardContent
    align={align}
    className={cn("w-auto p-2", className)}
    {...props}
  />
);

// ============================================================================
// AttachmentEmpty - Empty state
// ============================================================================

export type AttachmentEmptyProps = HTMLAttributes<HTMLDivElement>;

export const AttachmentEmpty = ({
                                  className,
                                  children,
                                  ...props
                                }: AttachmentEmptyProps) => {
  const t = useAgentMessages("attachments");

  return (
    <div
      className={cn(
        "flex items-center justify-center p-4 text-muted-foreground text-sm",
        className
      )}
      {...props}
    >
      {children ?? t.noAttachments}
    </div>
  );
};
