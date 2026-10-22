"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentMessages, useAgentLocale } from "../../i18n/runtime";
import {
  FolderInput,
  GripVertical,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";

import { useApiRequest } from "../../api/hooks/use-api-request";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/components/alert-dialog";
import { Button, buttonVariants } from "../../ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/components/dropdown-menu";
import { ScrollArea } from "../../ui/components/scroll-area";
import { Skeleton } from "../../ui/components/skeleton";
import { cn } from "../../ui/lib/utils";

import { isTerminalConversationTitleState } from "../hooks/use-chat/conversation-title";
import {
  type ConversationItem,
  ConversationStatus,
  ConversationQueryStatus,
  useConversationOperations,
} from "../hooks/use-chat/use-conversation-operations";
import {
  type ConversationTitleSyncUpdate,
  useConversationTitleSync,
} from "../hooks/use-chat/use-conversation-title-sync";
import { useConversationFolderPages } from "../hooks/use-chat/use-conversation-folder-pages";
import { useAiChatContext } from "./context";
import { ConversationNameDialog } from "./conversation-name-dialog";
import { toast } from "sonner";
import {
  matchesConversationView,
  notifyConversationStatusChanged,
  subscribeConversationLifecycle,
} from "../hooks/use-chat/conversation-lifecycle";
import {
  ConversationStatusFilter,
  ConversationArchiveMenuItem,
} from "./conversation-archive-controls";
import { useAiChatAccess } from "./use-ai-chat-access";
import { ConversationTree } from "./conversation-tree";

/** 列表加载时展示的占位行数量，保持与最终行高一致避免布局跳动。 */
const SKELETON_ROW_COUNT = 6;
const SKELETON_ROWS = Array.from(
  { length: SKELETON_ROW_COUNT },
  (_, index) => index,
);

function getConversationItemId(conversation: ConversationItem) {
  return conversation.conversationId;
}

/**
 * 会话列表文案。
 *
 * 使用方需要沿用自己应用字典时整体传入；未提供的字段使用本包字典。
 */
export interface ConversationListLabels {
  listTitle?: string;
  newConversation?: string;
  pendingConversation?: string;
  noConversations?: string;
  untitled?: string;
  deleteConversation?: string;
  deleteConfirmTitle?: string;
  deleteConfirmDesc?: string;
  deleteSuccess?: string;
  cancel?: string;
  allGroups?: string;
  ungrouped?: string;
  newGroup?: string;
  createGroup?: string;
  renameConversation?: string;
  groupConversation?: string;
  moreActions?: string;
  pinConversation?: string;
  unpinConversation?: string;
  moveToGroup?: string;
  loadMore?: string;
  groupsLoadFailed?: string;
  retryLoadGroups?: string;
  renameGroup?: string;
  deleteGroup?: string;
  deleteGroupConfirm?: string;
  nameDialogDescription?: string;
  nameLabel?: string;
  save?: string;
  saving?: string;
  expandFolder?: string;
  collapseFolder?: string;
  dragConversation?: string;
}

/** 兜底合并后的文案，组件内部只消费全部字段都已确定的版本。 */
type ResolvedConversationListLabels = Required<ConversationListLabels>;

/** 首条消息 POST 成功后需要立即同步标题的会话。 */
export interface ConversationListTitleSyncRequest {
  conversationId: string;
  firstUserMessage: string;
  requestId: number;
}

type ConversationRow = Pick<ConversationItem, "conversationId" | "title" | "status" | "lastUpdateTime" | "groupId" | "groupName">;
type ConversationListTreeItem = ConversationRow & {
  id: string;
  groupId: number | null;
  draggable?: boolean;
  pendingDraft?: boolean;
};

interface PendingGroupedDraft {
  groupId: number;
  conversationId: string;
  previousActiveConversationId?: string;
  createdTime: Date;
}

export interface ConversationListProps {
  /** 当前活跃会话，用于高亮列表项。 */
  activeConversationId?: string;
  /** 选中会话；调用方自行决定是否在该回调中关闭外层容器。 */
  onConversationSelect: (conversationId: string) => void;
  /** 新建会话。 */
  onNewConversation: (groupId?: number) => void;
  /** 外部刷新信号，变化即重新拉取列表。 */
  refreshSignal?: number;
  /** 首条消息提交后立即同步标题，缩短列表标题的占位时间。 */
  titleSyncRequest?: ConversationListTitleSyncRequest;
  /** 覆盖默认文案。 */
  labels?: ConversationListLabels;
  /** 是否渲染内置「新对话」按钮；外层已有等价入口时可关闭。 */
  showNewConversationButton?: boolean;
  /** 覆盖列表项相对时间的格式化实现。 */
  formatRelativeTime?: (date: string | Date) => string;
  /** 宿主支持置顶时提供；未提供则隐藏置顶入口。 */
  /** 置顶属于宿主本地状态，由宿主提供当前值。 */
  isConversationPinned?: (conversationId: string) => boolean;
  onTogglePinned?: (
    conversationId: string,
    pinned: boolean,
  ) => void | Promise<void>;
  className?: string;
}

/**
 * 会话列表。
 *
 * 统一承载会话列表的加载、标题异步同步、删除与空状态，供 Web 渠道侧边栏与
 * 智能体调试页对话记录抽屉共用；HTTP 客户端取自 `AiChatContextProvider`，
 * 因此列表范围由宿主的聊天入口决定。
 */
export function ConversationList({
  activeConversationId,
  onConversationSelect,
  onNewConversation,
  refreshSignal,
  titleSyncRequest,
  labels,
  showNewConversationButton = true,
  formatRelativeTime: formatRelativeTimeOverride,
  onTogglePinned,
  isConversationPinned,
  className,
}: ConversationListProps) {
  const access = useAiChatAccess();
  const canManage = access.canWrite && access.canExecute;
  const t = useAgentMessages("ai-conversation-list");
  const archiveContent = useAgentMessages("ai-conversation-archive-controls");
  const [statusFilter, setStatusFilter] = useState(
    ConversationQueryStatus.ACTIVE,
  );
  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;
  const { locale } = useAgentLocale();
  const formatRelativeTime =
    formatRelativeTimeOverride ??
    ((date: string | Date) => defaultFormatRelativeTime(date, locale));
  const {
    httpClient,
    setPendingConversationGroupId,
    clearPendingConversationGroupId,
  } = useAiChatContext();
  const {
    getConversationPage,
    updateStatus,
    deleteConversation,
    updateTitle,
    moveConversation,
    createConversationGroup,
    getConversationGroups,
    renameConversationGroup,
    deleteConversationGroup,
  } = useConversationOperations({ httpClient });
  const [pendingGroupedDraft, setPendingGroupedDraft] =
    useState<PendingGroupedDraft | null>(null);
  const pendingDraftSequenceRef = useRef(0);

  const handleNewConversation = useCallback(
    (groupId?: number) => {
      if (groupId === undefined) {
        setPendingGroupedDraft(null);
        clearPendingConversationGroupId();
      } else {
        pendingDraftSequenceRef.current += 1;
        setPendingGroupedDraft({
          groupId,
          conversationId: `pending-group:${pendingDraftSequenceRef.current}`,
          previousActiveConversationId: activeConversationId,
          createdTime: new Date(),
        });
        setPendingConversationGroupId(groupId);
      }
      onNewConversation(groupId);
    },
    [
      activeConversationId,
      clearPendingConversationGroupId,
      onNewConversation,
      setPendingConversationGroupId,
    ],
  );
  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      setPendingGroupedDraft(null);
      clearPendingConversationGroupId();
      onConversationSelect(conversationId);
    },
    [clearPendingConversationGroupId, onConversationSelect],
  );

  // 文案只在依赖变化时重建：`useConversationTitleSync` 的回调闭包依赖 untitled，
  // 若每次渲染都产出新字符串，会让加载回调不稳定并导致列表请求循环。
  const resolvedLabels: ResolvedConversationListLabels = useMemo(
    () => ({
      listTitle: labels?.listTitle ?? t.listTitle.value,
      newConversation: labels?.newConversation ?? t.newConversation.value,
      pendingConversation:
        labels?.pendingConversation ?? t.pendingConversation.value,
      noConversations: labels?.noConversations ?? t.noConversations.value,
      untitled: labels?.untitled ?? t.untitled.value,
      deleteConversation:
        labels?.deleteConversation ?? t.deleteConversation.value,
      deleteConfirmTitle:
        labels?.deleteConfirmTitle ?? t.deleteConfirmTitle.value,
      deleteConfirmDesc: labels?.deleteConfirmDesc ?? t.deleteConfirmDesc.value,
      deleteSuccess: labels?.deleteSuccess ?? t.deleteSuccess.value,
      cancel: labels?.cancel ?? t.cancel.value,
      allGroups: labels?.allGroups ?? t.allGroups.value,
      ungrouped: labels?.ungrouped ?? t.ungrouped.value,
      newGroup: labels?.newGroup ?? t.newGroup.value,
      createGroup: labels?.createGroup ?? t.createGroup.value,
      renameConversation:
        labels?.renameConversation ?? t.renameConversation.value,
      groupConversation: labels?.groupConversation ?? t.groupConversation.value,
      moreActions: labels?.moreActions ?? t.moreActions.value,
      pinConversation: labels?.pinConversation ?? t.pinConversation.value,
      unpinConversation: labels?.unpinConversation ?? t.unpinConversation.value,
      moveToGroup: labels?.moveToGroup ?? t.moveToGroup.value,
      loadMore: labels?.loadMore ?? t.loadMore.value,
      groupsLoadFailed: labels?.groupsLoadFailed ?? t.groupsLoadFailed.value,
      retryLoadGroups: labels?.retryLoadGroups ?? t.retryLoadGroups.value,
      renameGroup: labels?.renameGroup ?? t.renameGroup.value,
      deleteGroup: labels?.deleteGroup ?? t.deleteGroup.value,
      deleteGroupConfirm:
        labels?.deleteGroupConfirm ?? t.deleteGroupConfirm.value,
      nameDialogDescription:
        labels?.nameDialogDescription ?? t.nameDialogDescription.value,
      nameLabel: labels?.nameLabel ?? t.nameLabel.value,
      save: labels?.save ?? t.save.value,
      saving: labels?.saving ?? t.saving.value,
      expandFolder: labels?.expandFolder ?? t.expandFolder.value,
      collapseFolder: labels?.collapseFolder ?? t.collapseFolder.value,
      dragConversation: labels?.dragConversation ?? t.dragConversation.value,
    }),
    [
      labels?.listTitle,
      labels?.cancel,
      labels?.allGroups,
      labels?.ungrouped,
      labels?.newGroup,
      labels?.createGroup,
      labels?.renameConversation,
      labels?.groupConversation,
      labels?.moreActions,
      labels?.pinConversation,
      labels?.unpinConversation,
      labels?.moveToGroup,
      labels?.loadMore,
      labels?.groupsLoadFailed,
      labels?.retryLoadGroups,
      labels?.renameGroup,
      labels?.deleteGroup,
      labels?.deleteGroupConfirm,
      labels?.nameDialogDescription,
      labels?.nameLabel,
      labels?.save,
      labels?.saving,
      labels?.expandFolder,
      labels?.collapseFolder,
      labels?.dragConversation,
      labels?.deleteConfirmDesc,
      labels?.deleteConfirmTitle,
      labels?.deleteConversation,
      labels?.deleteSuccess,
      labels?.newConversation,
      labels?.pendingConversation,
      labels?.noConversations,
      labels?.untitled,
      t.listTitle.value,
      t.cancel.value,
      t.allGroups.value,
      t.ungrouped.value,
      t.newGroup.value,
      t.createGroup.value,
      t.renameConversation.value,
      t.groupConversation.value,
      t.moreActions.value,
      t.pinConversation.value,
      t.unpinConversation.value,
      t.moveToGroup.value,
      t.loadMore.value,
      t.groupsLoadFailed.value,
      t.retryLoadGroups.value,
      t.renameGroup.value,
      t.deleteGroup.value,
      t.deleteGroupConfirm.value,
      t.nameDialogDescription.value,
      t.nameLabel.value,
      t.save.value,
      t.saving.value,
      t.expandFolder.value,
      t.collapseFolder.value,
      t.dragConversation.value,
      t.deleteConfirmDesc.value,
      t.deleteConfirmTitle.value,
      t.deleteConversation.value,
      t.deleteSuccess.value,
      t.newConversation.value,
      t.pendingConversation.value,
      t.noConversations.value,
      t.untitled.value,
    ],
  );
  const folderPages = useConversationFolderPages({
    status: statusFilter,
    enabled: true,
    getGroups: getConversationGroups,
    getPage: getConversationPage,
    getConversationId: getConversationItemId,
  });
  const {
    reload: reloadFolders,
    reloadDirectory,
    reloadFolder,
    updateConversation: updateFolderConversation,
    removeConversation: removeFolderConversation,
  } = folderPages;
  const statusMutation = useApiRequest(
    async (conversationId: string, status: ConversationStatus) => {
      access.requireAccess("conversationWrite");
      access.requireAccess("execute");
      await updateStatus(conversationId, { status });
      if (matchesConversationView(statusFilterRef.current, status))
        updateFolderConversation(conversationId, (item) => ({
          ...item,
          status,
        }));
      else removeFolderConversation(conversationId);
      if (
        status === ConversationStatus.ARCHIVED &&
        conversationId === activeConversationIdRef.current
      )
        handleNewConversation();
      toast.success(
        status === ConversationStatus.ARCHIVED
          ? archiveContent.archiveSuccess.value
          : archiveContent.restoreSuccess.value,
      );
      notifyConversationStatusChanged(conversationId, status);
    },
    { manual: true },
  );
  useEffect(
    () =>
      subscribeConversationLifecycle((change) => {
        if (change) {
          if (matchesConversationView(statusFilterRef.current, change.status))
            updateFolderConversation(change.conversationId, (item) => ({
              ...item,
              status: change.status,
            }));
          else removeFolderConversation(change.conversationId);
        }
        void reloadFolders();
      }),
    [reloadFolders, updateFolderConversation, removeFolderConversation],
  );
  const conversations = folderPages.records;
  const groups = folderPages.groups.map(({ id, name }) => ({ id, name }));
  const loaded = folderPages.loaded;
  const [nameDialog, setNameDialog] = useState<
    | { kind: "create-group" }
    | { kind: "rename-group"; group: { id: number; name: string } }
    | { kind: "rename-conversation"; item: ConversationRow }
    | null
  >(null);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const previousRefreshSignal = useRef(refreshSignal);
  const titleOverridesRef = useRef(
    new Map<string, ConversationTitleSyncUpdate>(),
  );
  const handledTitleSyncRequestIdRef = useRef<number | null>(null);

  const handleConversationTitleChange = useCallback(
    (update: ConversationTitleSyncUpdate) => {
      titleOverridesRef.current.set(update.conversationId, update);
      updateFolderConversation(update.conversationId, (item) => ({
        ...item,
        title: update.title,
        titleState: update.titleState,
      }));
    },
    [updateFolderConversation],
  );
  const titleSync = useConversationTitleSync({
    httpClient,
    unnamedTitle: resolvedLabels.untitled,
    onTitleChange: handleConversationTitleChange,
  });

  const { runAsync: runDeleteConversation, loading: isDeletingConversation } =
    useApiRequest(deleteConversation, {
      manual: true,
      enableSuccessNotification: true,
      successMessage: resolvedLabels.deleteSuccess,
    });

  useEffect(() => {
    if (previousRefreshSignal.current === refreshSignal) return;
    previousRefreshSignal.current = refreshSignal;
    void reloadFolders();
  }, [reloadFolders, refreshSignal]);

  useEffect(() => {
    const records = conversations.map((item) => {
      const override = titleOverridesRef.current.get(item.conversationId);
      if (!override) return item;
      if (
        item.title === override.title &&
        item.titleState === override.titleState &&
        (override.source === "server" ||
          isTerminalConversationTitleState(item.titleState))
      ) {
        titleOverridesRef.current.delete(item.conversationId);
        return item;
      }
      return {
        ...item,
        title: override.title,
        titleState: override.titleState,
      };
    });
    titleSync.resume(
      records.filter(
        (item) =>
          titleOverridesRef.current.get(item.conversationId)?.source !==
          "local-timeout",
      ),
    );
  }, [conversations, titleSync]);

  const handleNameDialogSubmit = useCallback(
    async (name: string) => {
      if (!nameDialog) return false;
      try {
        if (nameDialog.kind === "create-group") {
          await createConversationGroup({ name });
          await reloadDirectory();
        } else if (nameDialog.kind === "rename-group") {
          if (name === nameDialog.group.name) return true;
          await renameConversationGroup(nameDialog.group.id, { name });
          await reloadDirectory();
        } else {
          if (name === (nameDialog.item.title ?? "")) return true;
          const metadata = await updateTitle(nameDialog.item.conversationId, {
            title: name,
          });
          titleOverridesRef.current.delete(nameDialog.item.conversationId);
          updateFolderConversation(nameDialog.item.conversationId, (item) => ({
            ...item,
            title: metadata.title,
            titleState: metadata.titleState,
            groupId: metadata.groupId,
            groupName: metadata.groupName,
            lastUpdateTime: metadata.lastUpdateTime,
          }));
          await reloadFolder(metadata.groupId);
        }
        return true;
      } catch {
        // API 统一提示错误；保留列表供重试。
        return false;
      }
    },
    [
      createConversationGroup,
      reloadDirectory,
      reloadFolder,
      updateFolderConversation,
      nameDialog,
      renameConversationGroup,
      updateTitle,
    ],
  );

  const handleDeleteGroup = useCallback(async () => {
    if (deletingGroupId === null) return;
    try {
      await deleteConversationGroup(deletingGroupId);
      await reloadDirectory();
    } catch {
      // API 统一提示错误；保留现有列表供重试。
    } finally {
      setDeletingGroupId(null);
    }
  }, [deleteConversationGroup, deletingGroupId, reloadDirectory]);

  const handleMove = useCallback(
    async (conversationId: string, groupId: number | null) => {
      try {
        const current = conversations.find(
          (item) => item.conversationId === conversationId,
        );
        await moveConversation(conversationId, groupId);
        updateFolderConversation(conversationId, (item) => ({
          ...item,
          groupId,
          groupName: groups.find((group) => group.id === groupId)?.name ?? null,
        }));
        await Promise.all([
          reloadFolder(current?.groupId ?? null),
          reloadFolder(groupId),
        ]);
      } catch {
        // API 统一提示错误；列表刷新以服务端状态为准。
      }
    },
    [
      conversations,
      reloadFolder,
      updateFolderConversation,
      groups,
      moveConversation,
    ],
  );

  useEffect(() => {
    if (!titleSyncRequest) return;
    if (handledTitleSyncRequestIdRef.current === titleSyncRequest.requestId)
      return;
    handledTitleSyncRequestIdRef.current = titleSyncRequest.requestId;
    const current = conversations.find(
      (item) => item.conversationId === titleSyncRequest.conversationId,
    );
    titleSync.start({
      conversationId: titleSyncRequest.conversationId,
      firstUserMessage: titleSyncRequest.firstUserMessage,
      currentTitle: current?.title,
    });
  }, [conversations, titleSync, titleSyncRequest]);

  const previousActiveConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    const previousId = previousActiveConversationIdRef.current;
    if (previousId && previousId !== activeConversationId)
      titleSync.stop(previousId);
    previousActiveConversationIdRef.current = activeConversationId;
  }, [activeConversationId, titleSync]);

  useEffect(() => {
    if (
      !pendingGroupedDraft ||
      !activeConversationId ||
      activeConversationId ===
        pendingGroupedDraft.previousActiveConversationId ||
      activeConversationId === pendingGroupedDraft.conversationId
    ) {
      return;
    }
    setPendingGroupedDraft((current) =>
      current?.conversationId === pendingGroupedDraft.conversationId
        ? { ...current, conversationId: activeConversationId }
        : current,
    );
  }, [activeConversationId, pendingGroupedDraft]);

  const pendingGroupedDraftConversationId =
    pendingGroupedDraft &&
    activeConversationId &&
    activeConversationId !== pendingGroupedDraft.previousActiveConversationId
      ? activeConversationId
      : pendingGroupedDraft?.conversationId;

  useEffect(() => {
    if (
      pendingGroupedDraftConversationId &&
      conversations.some(
        (item) => item.conversationId === pendingGroupedDraftConversationId,
      )
    ) {
      setPendingGroupedDraft(null);
    }
  }, [conversations, pendingGroupedDraftConversationId]);

  const handleDelete = useCallback(
    async (conversationId: string) => {
      try {
        await runDeleteConversation(conversationId);
        // 先从本地列表移除，确保删除结果立即反馈；随后重新请求服务端列表进行同步。
        const current = conversations.find(
          (item) => item.conversationId === conversationId,
        );
        removeFolderConversation(conversationId);
        titleOverridesRef.current.delete(conversationId);
        titleSync.stop(conversationId);
        // 删除的是当前活跃会话时，按新建会话处理该聊天区域。
        if (conversationId === activeConversationId) handleNewConversation();
        if (current) void reloadFolder(current.groupId ?? null);
      } catch {
        // useApiRequest 已统一处理错误提示，这里保持列表不变供用户重试。
      }
    },
    [
      activeConversationId,
      conversations,
      removeFolderConversation,
      reloadFolder,
      handleNewConversation,
      runDeleteConversation,
      titleSync,
    ],
  );

  // 仅在首次加载时用骨架屏占位：已有数据的刷新保留原列表，避免闪烁与布局跳动。
  const showSkeleton = !loaded;
  const treeConversations: ConversationListTreeItem[] = conversations.map(
    (item) => ({
      ...item,
      id: item.conversationId,
      draggable: canManage && item.status !== ConversationStatus.ARCHIVED,
      groupId: item.groupId ?? null,
    }),
  );
  if (
    pendingGroupedDraft &&
    pendingGroupedDraftConversationId &&
    !conversations.some(
      (item) => item.conversationId === pendingGroupedDraftConversationId,
    )
  ) {
    treeConversations.unshift({
      id: pendingGroupedDraftConversationId,
      conversationId: pendingGroupedDraftConversationId,
      title: resolvedLabels.pendingConversation,
      status: ConversationStatus.ACTIVE,
      lastUpdateTime: pendingGroupedDraft.createdTime,
      groupId: pendingGroupedDraft.groupId,
      groupName:
        groups.find((group) => group.id === pendingGroupedDraft.groupId)
          ?.name ?? null,
      draggable: false,
      pendingDraft: true,
    });
  }

  return (
    <div className={cn("flex min-h-0 w-full min-w-0 flex-col", className)}>
      {showNewConversationButton && (
        <div className="shrink-0 px-2 py-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"
            onClick={() => handleNewConversation()}
          >
            <MessageSquarePlus className="size-4" data-icon="inline-start" />
            <span className="text-xs">{resolvedLabels.newConversation}</span>
          </Button>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1" overflowXHidden>
        <div className="w-full min-w-0 px-0 py-0.5">
          {showSkeleton ? (
            <div className="flex w-full flex-col gap-0.5" aria-hidden="true">
              {SKELETON_ROWS.map((row) => (
                <div
                  key={row}
                  className="flex flex-col gap-1 rounded-md px-2.5 py-2"
                >
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {folderPages.directoryFailed && (
                <div
                  className="mb-2 flex items-center justify-between gap-2 rounded-md border border-sidebar-border px-2.5 py-2 text-xs text-sidebar-foreground/70"
                  role="alert"
                >
                  <span>{resolvedLabels.groupsLoadFailed}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void reloadDirectory()}
                  >
                    {resolvedLabels.retryLoadGroups}
                  </Button>
                </div>
              )}
              <ConversationTree
                headerActions={
                  <ConversationStatusFilter
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                }
                items={treeConversations}
                groups={groups}
                labels={{
                  listTitle: resolvedLabels.listTitle,
                  createGroup: resolvedLabels.createGroup,
                  ungrouped: resolvedLabels.ungrouped,
                  expandFolder: resolvedLabels.expandFolder,
                  collapseFolder: resolvedLabels.collapseFolder,
                  dragConversation: resolvedLabels.dragConversation,
                  loadMore: resolvedLabels.loadMore,
                }}
                onCreateGroup={() => setNameDialog({ kind: "create-group" })}
                onMove={(conversationId, groupId) =>
                  void handleMove(conversationId, groupId)
                }
                onLoadMoreFolder={(groupId) =>
                  void folderPages.loadMore(groupId)
                }
                folderPagination={(groupId) => {
                  const folder = folderPages.folders.find(
                    (item) => item.groupId === groupId,
                  );
                  return {
                    loadMoreLabel: archiveContent.loadMore({
                      count: Math.max(
                        0,
                        (folder?.total ?? 0) - (folder?.records.length ?? 0),
                      ),
                    }).value,
                    hasMore: Boolean(
                      folder && folder.records.length < folder.total,
                    ),
                    loading: folder?.loading ?? false,
                    failed: folder?.failed ?? false,
                  };
                }}
                groupActions={
                  canManage
                    ? {
                        newConversation: resolvedLabels.newConversation,
                        moreActions: resolvedLabels.moreActions,
                        rename: resolvedLabels.renameGroup,
                        remove: resolvedLabels.deleteGroup,
                        onNewConversation: (group) =>
                          handleNewConversation(group.id),
                        onRename: (group) =>
                          setNameDialog({ kind: "rename-group", group }),
                        onRemove: (group) => setDeletingGroupId(group.id),
                      }
                    : undefined
                }
                emptyState={
                  <div className="px-2 py-8 text-center text-xs text-sidebar-foreground/40">
                    {resolvedLabels.noConversations}
                  </div>
                }
                renderItem={(item, drag) => (
                  <ConversationItemRow
                    key={item.conversationId}
                    item={item}
                    isConversationPinned={isConversationPinned}
                    canManage={canManage}
                    dragRef={drag.ref}
                    archiving={statusMutation.loading}
                    onArchive={() =>
                      void statusMutation
                        .runAsync(
                          item.conversationId,
                          item.status === ConversationStatus.ARCHIVED
                            ? ConversationStatus.ACTIVE
                            : ConversationStatus.ARCHIVED,
                        )
                        .catch(() => undefined)
                    }
                    pendingDraft={item.pendingDraft === true}
                    active={
                      item.pendingDraft === true ||
                      item.conversationId === activeConversationId
                    }
                    formatRelativeTime={formatRelativeTime}
                    labels={resolvedLabels}
                    onSelect={() =>
                      handleConversationSelect(item.conversationId)
                    }
                    onDelete={() => void handleDelete(item.conversationId)}
                    onRename={() =>
                      setNameDialog({ kind: "rename-conversation", item })
                    }
                    onMove={(groupId) =>
                      void handleMove(item.conversationId, groupId)
                    }
                    groups={groups}
                    deleting={isDeletingConversation}
                    onTogglePinned={
                      onTogglePinned
                        ? (pinned) =>
                            onTogglePinned(item.conversationId, pinned)
                        : undefined
                    }
                  />
                )}
              />
            </>
          )}
        </div>
      </ScrollArea>
      <ConversationNameDialog
        open={nameDialog !== null}
        title={
          nameDialog?.kind === "create-group"
            ? resolvedLabels.newGroup
            : nameDialog?.kind === "rename-group"
              ? resolvedLabels.renameGroup
              : resolvedLabels.renameConversation
        }
        initialValue={
          nameDialog?.kind === "rename-group"
            ? nameDialog.group.name
            : nameDialog?.kind === "rename-conversation"
              ? (nameDialog.item.title ?? "")
              : ""
        }
        maxLength={nameDialog?.kind === "rename-conversation" ? 255 : 60}
        labels={{
          description: resolvedLabels.nameDialogDescription,
          nameLabel: resolvedLabels.nameLabel,
          cancel: resolvedLabels.cancel,
          submit: resolvedLabels.save,
          submitting: resolvedLabels.saving,
        }}
        onOpenChange={(open) => {
          if (!open) setNameDialog(null);
        }}
        onSubmit={handleNameDialogSubmit}
      />
      <AlertDialog
        open={deletingGroupId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingGroupId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{resolvedLabels.deleteGroup}</AlertDialogTitle>
            <AlertDialogDescription>
              {resolvedLabels.deleteGroupConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{resolvedLabels.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteGroup()}>
              {resolvedLabels.deleteGroup}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 默认的相对时间展示：取 ISO 时间字符串的日期部分，避免引入应用级日期依赖。 */
function defaultFormatRelativeTime(
  date: string | Date,
  locale: string,
): string {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "—";
  const seconds = (value.getTime() - Date.now()) / 1000;
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 24 * 60 * 60],
    ["month", 30 * 24 * 60 * 60],
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const range = ranges.find(([, divisor]) => Math.abs(seconds) >= divisor);
  const unit = range?.[0] ?? "second";
  const amount = range ? Math.round(seconds / range[1]) : 0;
  const language = locale === "zh" ? "zh-CN" : "en-US";
  return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
    amount,
    unit,
  );
}

/** 单个会话项 */
function ConversationItemRow({
  item,
  pendingDraft,
  active,
  formatRelativeTime,
  labels,
  onSelect,
  onDelete,
  onRename,
  onMove,
  groups,
  deleting,
  onTogglePinned,
  onArchive,
  canManage,
  archiving,
  isConversationPinned,
  dragRef,
}: {
  canManage: boolean;
  onArchive: () => void;
  archiving: boolean;
  dragRef: (element: Element | null) => void;
  item: ConversationRow;
  pendingDraft: boolean;
  active: boolean;
  formatRelativeTime: (date: string | Date) => string;
  labels: ResolvedConversationListLabels;
  onSelect: () => void;
  onDelete: () => void;
  onRename: () => void;
  onMove: (groupId: number | null) => void;
  groups: { id: number; name: string }[];
  deleting: boolean;
  isConversationPinned?: (conversationId: string) => boolean;
  onTogglePinned?: (pinned: boolean) => void | Promise<void>;
}) {
  const archived = item.status === ConversationStatus.ARCHIVED;
  const title = item.title ?? labels.untitled;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [moreActionsVisible, setMoreActionsVisible] = useState(false);
  const pinned = isConversationPinned?.(item.conversationId) ?? false;
  const keepMoreActionsVisible = moreActionsOpen || moreActionsVisible;

  return (
    <>
      <div
        className={cn(
          "group flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-1 transition-colors",
          active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
          archived
            ? "text-sidebar-muted-foreground"
            : active
              ? "text-sidebar-primary"
              : "text-sidebar-foreground",
          keepMoreActionsVisible && !active && "bg-sidebar-accent/50",
        )}
      >
        <button
          type="button"
          disabled={
            pendingDraft && item.conversationId.startsWith("pending-group:")
          }
          className={cn(
            "min-w-0 flex-1 cursor-pointer truncate text-left text-[13px]",
            archived && "opacity-70",
          )}
          onClick={onSelect}
        >
          {title}
        </button>
        {!pendingDraft && (
          <time
            dateTime={item.lastUpdateTime.toISOString()}
            className={cn(
              "shrink-0 whitespace-nowrap pl-2 text-xs text-sidebar-foreground/50 group-hover:hidden group-focus-within:hidden",
              keepMoreActionsVisible && "hidden",
            )}
          >
            {formatRelativeTime(item.lastUpdateTime)}
          </time>
        )}
        {!pendingDraft && canManage && (
          <div
            className={cn(
              "hidden shrink-0 items-center justify-end gap-0.5 group-hover:flex group-focus-within:flex",
              keepMoreActionsVisible && "flex",
              archived ? "w-7" : "w-14",
            )}
          >
            {!archived && (
              <Button
                ref={dragRef}
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 touch-none cursor-grab active:cursor-grabbing"
                aria-label={labels.dragConversation}
              >
                <GripVertical className="size-3.5" />
              </Button>
            )}
            <DropdownMenu
              open={moreActionsOpen}
              onOpenChange={(open) => {
                setMoreActionsOpen(open);
                if (open) setMoreActionsVisible(true);
              }}
            >
              <DropdownMenuTrigger
                type="button"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "size-6",
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
                    setMoreActionsVisible(false);
                  }
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {!archived && (
                  <>
                    <DropdownMenuItem onSelect={onRename}>
                      <Pencil />
                      {labels.renameConversation}
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput />
                        {labels.groupConversation}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={
                            item.groupId == null
                              ? "ungrouped"
                              : String(item.groupId)
                          }
                          onValueChange={(value) =>
                            onMove(value === "ungrouped" ? null : Number(value))
                          }
                        >
                          <DropdownMenuRadioItem value="ungrouped">
                            {labels.ungrouped}
                          </DropdownMenuRadioItem>
                          {groups.map((group) => (
                            <DropdownMenuRadioItem
                              key={group.id}
                              value={String(group.id)}
                            >
                              {group.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {onTogglePinned && (
                      <DropdownMenuItem
                        onSelect={() => void onTogglePinned(!pinned)}
                      >
                        {pinned ? <PinOff /> : <Pin />}
                        {pinned
                          ? labels.unpinConversation
                          : labels.pinConversation}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <ConversationArchiveMenuItem
                  archived={archived}
                  disabled={archiving}
                  onSelect={onArchive}
                />
                {archived && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deleting}
                      onSelect={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 />
                      {labels.deleteConversation}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {labels.deleteConfirmDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {labels.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={deleting}>
              {labels.deleteConversation}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
