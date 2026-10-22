"use client";

import { Archive, ArchiveRestore, ListFilter } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { Button } from "../../ui/components/button";
import { Badge } from "../../ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../../ui/components/dropdown-menu";
import { ConversationQueryStatus } from "../hooks/use-chat/use-conversation-operations";

/** 会话列表状态筛选，不保存用户偏好。 */
export function ConversationStatusFilter({
  value,
  onChange,
}: {
  value: ConversationQueryStatus;
  onChange: (value: ConversationQueryStatus) => void;
}) {
  const t = useAgentMessages("ai-conversation-status-filter");
  const labels = {
    [ConversationQueryStatus.ACTIVE]: t.active,
    [ConversationQueryStatus.ALL]: t.all,
    [ConversationQueryStatus.ARCHIVED]: t.archivedOnly,
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-normal"
          aria-label={t.view.value}
        >
          <ListFilter className="size-3.5" />
          {labels[value].value}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (
              Object.values(ConversationQueryStatus).includes(
                next as ConversationQueryStatus,
              )
            )
              onChange(next as ConversationQueryStatus);
          }}
        >
          {Object.values(ConversationQueryStatus).map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {labels[status].value}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 归档标识。 */
export function ConversationArchivedBadge() {
  const t = useAgentMessages("ai-conversation-archived-badge");
  return (
    <Badge variant="secondary" className="shrink-0 text-xs font-normal">
      {t.archived.value}
    </Badge>
  );
}

/** 会话菜单中的归档或恢复操作。 */
export function ConversationArchiveMenuItem({
  archived,
  disabled,
  onSelect,
}: {
  archived: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const t = useAgentMessages("ai-conversation-archive-menu-item");
  return (
    <DropdownMenuItem disabled={disabled} onSelect={onSelect}>
      {archived ? <ArchiveRestore /> : <Archive />}
      {archived ? t.restore.value : t.archive.value}
    </DropdownMenuItem>
  );
}

/** 归档历史的只读提示与恢复入口。 */
export function ConversationArchiveNotice({
  onRestore,
  restoring,
  canRestore,
}: {
  onRestore: () => void;
  restoring: boolean;
  canRestore: boolean;
}) {
  const t = useAgentMessages("ai-conversation-archive-notice");
  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 text-sm text-muted-foreground"
    >
      <span>{t.notice.value}</span>
      {canRestore && (
        <Button
          variant="outline"
          size="sm"
          disabled={restoring}
          onClick={onRestore}
        >
          <ArchiveRestore className="size-4" />
          {t.restore.value}
        </Button>
      )}
    </div>
  );
}

/** 状态首次获取失败时保留历史内容并允许重试。 */
export function ConversationLifecycleUnavailable({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const t = useAgentMessages("ai-conversation-lifecycle-unavailable");
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 text-sm text-muted-foreground"
    >
      <span>{t.unavailable.value}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t.retry.value}
      </Button>
    </div>
  );
}
