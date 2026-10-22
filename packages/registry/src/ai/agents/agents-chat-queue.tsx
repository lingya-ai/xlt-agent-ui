"use client";

import { useState } from "react";
import { Clock3Icon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { toast } from "../../ui/components/sonner";
import { cn } from "../../ui/lib/utils";

import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueList,
} from "../components/queue";
import type { ChatItem } from "../hooks/use-chat/types";

const QUEUE_ROW_HEIGHT_PX = 24;
const MAX_VISIBLE_QUEUE_ROWS = 2;

interface AgentsChatQueueProps {
  messages: readonly ChatItem[];
  canCancel?: boolean;
  onCancel?: (messageId: string) => Promise<void>;
  /** 嵌入贴片时由父容器提供背景和边框。 */
  variant?: "standalone" | "embedded";
}

/** 输入框上方的持久消息队列，按服务端顺序展示并支持逐条取消。 */
export function AgentsChatQueue({ messages, onCancel, canCancel = true, variant = "standalone" }: AgentsChatQueueProps) {
  const t = useAgentMessages("agents-chat-queue");
  const [cancellingMessageIds, setCancellingMessageIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  if (messages.length === 0) return null;

  const handleCancel = async (messageId: string) => {
    if (!onCancel || cancellingMessageIds.has(messageId)) return;

    setCancellingMessageIds((current) => new Set(current).add(messageId));
    try {
      await onCancel(messageId);
    } catch (error) {
      console.error("取消排队消息失败", error);
      toast.error(t.cancelFailed);
    } finally {
      setCancellingMessageIds((current) => {
        const next = new Set(current);
        next.delete(messageId);
        return next;
      });
    }
  };

  const listHeight =
    Math.min(messages.length, MAX_VISIBLE_QUEUE_ROWS) * QUEUE_ROW_HEIGHT_PX;

  return (
    <Queue className={cn(
      "gap-1 px-2 py-1",
      variant === "embedded"
        ? "rounded-none border-0 bg-transparent shadow-none"
        : "mb-2 rounded-lg",
    )}>
      <div className="flex h-5 items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
        <Clock3Icon className="size-3.5" aria-hidden="true" />
        <span>{t.title({ count: messages.length })}</span>
      </div>
      <QueueList
        className="-mb-0 mt-0"
        overflowXHidden
        style={{ height: listHeight }}
      >
        {messages.map((message) => {
          const attachmentCount = message.user?.attachments?.length ?? 0;
          const text = message.user?.text?.trim();
          const content =
            text ||
            (attachmentCount > 0
              ? t.attachmentOnly({ count: attachmentCount })
              : t.emptyMessage);
          const cancelling = cancellingMessageIds.has(message.id);

          return (
            <QueueItem
              className="h-6 flex-row items-center gap-2 px-2 py-0"
              key={message.id}
            >
              <QueueItemContent className="min-w-0 truncate text-xs text-foreground">
                {content}
              </QueueItemContent>
              {text && attachmentCount > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <PaperclipIcon className="size-3" aria-hidden="true" />
                  <span>{attachmentCount}</span>
                </span>
              )}
              {onCancel && (
                <QueueItemActions className="shrink-0">
                  <QueueItemAction
                    aria-label={t.cancel.value}
                    className={cn(
                      "opacity-100 [@media(hover:hover)]:opacity-0",
                      "group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100",
                      cancelling &&
                        "opacity-100 [@media(hover:hover)]:opacity-100",
                    )}
                    disabled={cancelling || !canCancel}
                    onClick={() => void handleCancel(message.id)}
                    title={t.cancel.value}
                  >
                    {cancelling ? (
                      <Loader2Icon
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <XIcon aria-hidden="true" />
                    )}
                  </QueueItemAction>
                </QueueItemActions>
              )}
            </QueueItem>
          );
        })}
      </QueueList>
    </Queue>
  );
}
