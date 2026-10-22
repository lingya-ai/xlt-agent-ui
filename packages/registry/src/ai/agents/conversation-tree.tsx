"use client";

import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  DragOverlay,
  DragDropProvider,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button, buttonVariants } from "../../ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/components/dropdown-menu";
import { cn } from "../../ui/lib/utils";

/** 可放入共享会话树的最小会话数据。 */
export interface ConversationTreeItem {
  id: string;
  groupId: number | null;
  lastUpdateTime: string | Date;
  pinned?: boolean;
  draggable?: boolean;
}

/** 会话树分组目录。 */
export interface ConversationTreeGroup {
  id: number;
  name: string;
  /** 分组内存在执行、待确认或未读会话时显示统一提示。 */
  hasActivity?: boolean;
  /** 分组内包含当前选中的会话，仅激活文件夹图标。 */
  isActive?: boolean;
}

/** 会话树的本地化分组标题。 */
export interface ConversationTreeLabels {
  listTitle: string;
  createGroup: string;
  ungrouped: string;
  expandFolder: string;
  collapseFolder: string;
  dragConversation: string;
  loadMore: string;
}

/** 会话树目录行的附加操作。 */
export interface ConversationTreeGroupActions {
  newConversation: string;
  moreActions: string;
  rename: string;
  remove: string;
  onNewConversation: (group: ConversationTreeGroup) => void;
  onRename: (group: ConversationTreeGroup) => void;
  onRemove: (group: ConversationTreeGroup) => void;
  render?: (
    group: ConversationTreeGroup,
    onNewConversation: () => void,
  ) => ReactNode;
}

/** 分组目录右侧的更多操作菜单。 */
export interface ConversationTreeGroupMenuProps {
  labels: Pick<
    ConversationTreeGroupActions,
    "newConversation" | "moreActions" | "rename" | "remove"
  >;
  onNewConversation: () => void;
  onRename: () => void;
  onRemove: () => void;
  disabled?: boolean;
  newConversationDisabled?: boolean;
}

/** 统一管理分组目录、会话排序和拖放容器。 */
export interface ConversationTreeProps<T extends ConversationTreeItem> {
  groups: ConversationTreeGroup[];
  items: T[];
  labels: ConversationTreeLabels;
  onCreateGroup: () => void;
  onMove: (conversationId: string, groupId: number | null) => void;
  onLoadMoreFolder?: (groupId: number | null) => void;
  folderPagination?: (groupId: number | null) => {
    hasMore: boolean;
    loading: boolean;
    failed: boolean;
    loadMoreLabel?: string;
  };
  renderItem: (item: T, drag: ConversationTreeDragHandle) => ReactNode;
  headerActions?: ReactNode;
  renderCreateGroupButton?: (onCreateGroup: () => void) => ReactNode;
  dragDropOptions?: ConversationTreeDragDropOptions;
  dragOverlay?: ReactNode;
  groupActions?: ConversationTreeGroupActions;
  emptyState?: ReactNode;
  className?: string;
}

/** 宿主可将该 ref 绑定到自定义拖动把手。 */
export interface ConversationTreeDragHandle {
  ref: (element: Element | null) => void;
}

/** 宿主可覆写传感器、碰撞检测等拖放 Provider 设置。 */
export type ConversationTreeDragDropOptions = Omit<
  ComponentProps<typeof DragDropProvider>,
  "children" | "onDragEnd"
>;

/** 在分组目录行中显示新会话按钮和维护菜单，并在菜单退场时保留定位按钮。 */
export function ConversationTreeGroupMenu({
  labels,
  onNewConversation,
  onRename,
  onRemove,
  disabled = false,
  newConversationDisabled = false,
}: ConversationTreeGroupMenuProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const keepVisible = open || visible;

  return (
    <div
      className={cn(
        "absolute right-0 top-1/2 hidden -translate-y-1/2 items-center bg-sidebar group-hover/folder:flex group-focus-within/folder:flex",
        keepVisible && "flex",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={newConversationDisabled}
        className="size-7"
        aria-label={labels.newConversation}
        title={labels.newConversation}
        onClick={onNewConversation}
      >
        <MessageSquarePlus aria-hidden="true" className="size-3.5" />
      </Button>
      <DropdownMenu
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setVisible(true);
        }}
      >
        <DropdownMenuTrigger
          type="button"
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "size-7",
          )}
          aria-label={labels.moreActions}
          title={labels.moreActions}
        >
          <MoreHorizontal aria-hidden="true" className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.currentTarget.dataset.state === "closed"
            ) {
              setVisible(false);
            }
          }}
        >
          <DropdownMenuItem disabled={disabled} onSelect={onRename}>
            <Pencil className="size-3.5" />
            {labels.rename}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={disabled}
            onSelect={onRemove}
          >
            <Trash2 className="size-3.5" />
            {labels.remove}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function parseTime(value: string | Date): Date | null {
  const result = value instanceof Date ? value : new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

function sortByRecent<T extends ConversationTreeItem>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime =
      parseTime(left.lastUpdateTime)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightTime =
      parseTime(right.lastUpdateTime)?.getTime() ?? Number.NEGATIVE_INFINITY;
    return rightTime - leftTime || left.id.localeCompare(right.id);
  });
}

function DraggableConversation({
  item,
  label,
  renderItem,
}: {
  item: ConversationTreeItem;
  label: string;
  renderItem: (drag: ConversationTreeDragHandle) => ReactNode;
}) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `conversation:${item.id}`,
    data: {
      kind: "conversation",
      conversationId: item.id,
      groupId: item.groupId,
    },
  });
  if (item.draggable === false) {
    return (
      <div
        role="listitem"
        aria-roledescription={label}
        className="w-full min-w-0"
      >
        {renderItem({ ref: () => {} })}
      </div>
    );
  }
  return (
    <div
      ref={ref}
      role="listitem"
      tabIndex={0}
      aria-roledescription={label}
      className={cn("w-full min-w-0", isDragging && "opacity-40")}
    >
      {renderItem({ ref: handleRef })}
    </div>
  );
}

function DroppableFolder({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { ref, isDropTarget } = useDroppable({
    id,
    data: {
      kind: "conversation-folder",
      groupId:
        id === "folder:ungrouped" ? null : Number(id.slice("folder:".length)),
    },
  });
  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget &&
          "rounded-md bg-sidebar-accent/70 ring-1 ring-sidebar-border",
      )}
    >
      {children}
    </div>
  );
}

/**
 * 共享会话树：管理分组目录折叠、会话时间倒序和拖动会话到文件夹。
 */
export function ConversationTree<T extends ConversationTreeItem>({
  groups,
  items,
  labels,
  onCreateGroup,
  onMove,
  renderItem,
  headerActions,
  renderCreateGroupButton,
  dragDropOptions,
  dragOverlay,
  groupActions,
  emptyState,
  onLoadMoreFolder,
  folderPagination,
  className,
}: ConversationTreeProps<T>) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  const groupedItems = useMemo(() => {
    const sorted = sortByRecent(items);
    return new Map<number | null, T[]>([
      ...groups.map(
        (group) =>
          [
            group.id,
            sorted.filter((item) => item.groupId === group.id),
          ] as const,
      ),
      [null, sorted.filter((item) => item.groupId === null)],
    ]);
  }, [groups, items]);

  const toggleFolder = (key: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandFolder = (key: string) => {
    setCollapsedFolders((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return;
    const source = event.operation.source?.data;
    const target = event.operation.target?.data;
    if (!source) return;
    if (
      source.kind !== "conversation" ||
      target?.kind !== "conversation-folder"
    )
      return;
    const conversationId = source.conversationId;
    const groupId = target.groupId;
    if (
      typeof conversationId === "string" &&
      (groupId === null || typeof groupId === "number") &&
      groupId !== source.groupId
    ) {
      onMove(conversationId, groupId);
    }
  };

  const renderFolderContents = (folderItems: T[]) =>
    folderItems.map((item) => (
      <DraggableConversation
        key={item.id}
        item={item}
        label={labels.dragConversation}
        renderItem={(drag) => renderItem(item, drag)}
      ></DraggableConversation>
    ));

  const renderFolder = (
    id: number | null,
    name: string,
    isUngrouped = false,
    hasActivity = false,
    isActive = false,
  ) => {
    const key = isUngrouped ? "folder:ungrouped" : `folder:${id}`;
    const collapsed = collapsedFolders.has(key);
    const folderItems = groupedItems.get(id) ?? [];
    const pagination = folderPagination?.(id);
    const contents = (
      <>
        {renderFolderContents(folderItems)}
        {pagination && (pagination.hasMore || pagination.failed) && (
          <div className="flex justify-start px-8 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs font-normal"
              disabled={pagination.loading}
              onClick={() => onLoadMoreFolder?.(id)}
            >
              {pagination.loading ? (
                <span
                  aria-hidden="true"
                  className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
                />
              ) : (
                (pagination.loadMoreLabel ?? labels.loadMore)
              )}
            </Button>
          </div>
        )}
      </>
    );
    if (isUngrouped) {
      return (
        <DroppableFolder
          key={key}
          id={key}
          className="w-full min-w-0 px-0 py-0.5"
        >
          {groups.length > 0 && (
            <div className="px-2 pb-1 pt-1 text-xs font-medium text-sidebar-muted-foreground">
              {name}
            </div>
          )}
          {contents}
        </DroppableFolder>
      );
    }
    return (
      <DroppableFolder
        key={key}
        id={key}
        className="w-full min-w-0 px-0 py-0.5"
      >
        <div className="group/folder relative flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={collapsed ? labels.expandFolder : labels.collapseFolder}
            aria-expanded={!collapsed}
            onClick={() => toggleFolder(key)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative inline-flex size-4 shrink-0",
                !hasActivity && !isActive && "text-sidebar-muted-foreground",
              )}
              style={
                hasActivity || isActive
                  ? { color: "var(--brand-action)" }
                  : undefined
              }
            >
              {hasActivity && (
                <span className="absolute -left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-current motion-safe:animate-pulse" />
              )}
              {collapsed ? (
                <Folder className="size-4" />
              ) : (
                <FolderOpen className="size-4" />
              )}
            </span>
          </Button>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-xs font-medium text-sidebar-foreground group-hover/folder:pr-14 group-focus-within/folder:pr-14"
            aria-expanded={!collapsed}
            onClick={() => toggleFolder(key)}
          >
            {name}
          </button>
          {!isUngrouped &&
            groupActions &&
            id !== null &&
            (groupActions.render?.({ id, name }, () => {
              expandFolder(key);
              groupActions.onNewConversation({ id, name });
            }) ?? (
              <ConversationTreeGroupMenu
                labels={groupActions}
                onNewConversation={() => {
                  expandFolder(key);
                  groupActions.onNewConversation({ id, name });
                }}
                onRename={() => groupActions.onRename({ id, name })}
                onRemove={() => groupActions.onRemove({ id, name })}
              />
            ))}
        </div>
        {!collapsed && contents}
      </DroppableFolder>
    );
  };

  return (
    <DragDropProvider {...dragDropOptions} onDragEnd={handleDragEnd}>
      <div className={cn("flex min-h-0 w-full min-w-0 flex-col", className)}>
        <div className="flex w-full shrink-0 items-center justify-between gap-2 px-2 py-0.5">
          <span className="min-w-0 truncate text-xs font-medium text-sidebar-muted-foreground">
            {labels.listTitle}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {headerActions}
            {renderCreateGroupButton?.(onCreateGroup) ?? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={labels.createGroup}
                title={labels.createGroup}
                onClick={onCreateGroup}
              >
                <FolderPlus />
              </Button>
            )}
          </div>
        </div>
        {items.length === 0 && emptyState}
        <div role="list" className="flex min-h-0 w-full min-w-0 flex-col">
          {groups.map((group) =>
            renderFolder(
              group.id,
              group.name,
              false,
              group.hasActivity,
              group.isActive,
            ),
          )}
          {items.length > 0 && renderFolder(null, labels.ungrouped, true)}
        </div>
      </div>
      <DragOverlay>{dragOverlay}</DragOverlay>
    </DragDropProvider>
  );
}
