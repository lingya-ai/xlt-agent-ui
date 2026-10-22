"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CopyIcon,
  Loader2,
  PauseIcon,
  XCircleIcon,
} from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { PermissionExplanation } from "../../integration/access";
import { useAiChatAccess } from "./use-ai-chat-access";

import { Button } from "../../ui/components/button";
import { toast } from "../../ui/components/sonner";
import { cn } from "../../ui/lib/utils";

import {
  Checkpoint,
  CheckpointIcon,
  CheckpointTrigger,
} from "../components/checkpoint";
import { CitationMessageResponse } from "../components/citation-message-response";
import { KnowledgeCitationSheet } from "../components/knowledge-citation-sheet";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "../components/message";
import { Shimmer } from "../components/shimmer";
import {
  CitationContext,
  type CitationKey,
  useCitationData,
} from "../hooks/use-chat/citation-context";
import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import { isTerminalMessageStatus } from "../hooks/use-chat/conversation-message-status";
import { resolveConversationExecutionType } from "../hooks/use-chat/conversation-execution-type";
import {
  AiChatEventTypeEnum,
  CompactorWarningLevelEnum,
} from "../hooks/use-chat/schema";
import type { AssistantChatMessage, ChatItem } from "../hooks/use-chat/types";
import { useCitationMetadata } from "../hooks/use-chat/use-citation-metadata";
import type {
  UserInputAnswerMessageParams,
  UserInputAnswerOutput,
} from "../hooks/use-chat/use-hitl";
import { formatWorkingDuration, MS_PER_SECOND } from "../lib/time";
import { AssistantMessageArtifacts } from "./assistant-message-artifacts";
import { useAiChatContext } from "./context";
import {
  AiChatContextEventProvider,
  useAiChatContextEvent,
  useAiChatContextEventValue,
  useOptionalAiChatContextEvent,
} from "./events";
import { useMessageViewController } from "./message-view-controller";
import { MessageViewSwitcher, MessageViewToggle } from "./message-view-switcher";
import {
  buildAssistantTurnProjection,
  type AgentsChatMessageViewMode,
  type AgentsChatMessageViewOptions,
  type AssistantTurnProjection,
  type AssistantWorkingState,
} from "./message-disclosure-policy";
import { AssistantTurnProcess } from "./assistant-turn-process";
import {
  useMessageDisclosureState,
  type MessageDisclosureState,
} from "./use-message-disclosure-state";
import { TurnExecutionStats } from "./turn-execution-stats";
import { UserMessageAttachments } from "./user-message-attachments";
import { VirtualizedMessageList } from "./virtualized-message-list";

/**
 * 智能体聊天消息组件属性
 */
export type AgentsChatMessageProps = {
  /** 聊天消息列表 */
  chatList: ChatItem[];

  /** 会话 ID */
  conversationId?: string;

  /**
   * 容器类名
   */
  className?: string;

  /**
   * 滚动内容区域类名（传递给 ConversationContent）
   */
  contentClassName?: string;

  /** 用户回答提问的回调 */
  onUserInputAnswer?: (
    params: UserInputAnswerMessageParams,
  ) => Promise<UserInputAnswerOutput>;

  /** 计划审批回调 */
  onPlanApproval?: (params: {
    messageId: string;
    approved: boolean;
    feedback?: string;
  }) => void;

  /** 是否还有更早的消息可加载 */
  hasOlderMessages?: boolean;

  /** 是否正在加载更早消息 */
  isLoadingOlder?: boolean;

  /** 加载更早消息回调 */
  onLoadOlderMessages?: () => void;

  /** 是否显示页面级消息导航器，嵌套聊天默认关闭 */
  showMessageNavigator?: boolean;

  /** 是否显示消息执行中的状态提示，默认显示 */
  showWorkingIndicator?: boolean;

  /** 消息展示策略，默认使用重点模式；切换入口由 switchable 控制。 */
  messageView?: AgentsChatMessageViewOptions;

  /** 取消尚未开始执行的排队消息。 */
  onCancelQueuedMessage?: (messageId: string) => Promise<void>;

  /** 在每条助手消息内容末尾渲染业务扩展区域。 */
  renderAssistantMessageFooter?: (
    context: AgentsChatAssistantMessageFooterContext,
  ) => React.ReactNode;

  /** 在助手消息末尾统计行的复制按钮之后渲染业务扩展操作。 */
  renderAssistantMessageStatsActions?: (
    context: AgentsChatAssistantMessageFooterContext,
  ) => React.ReactNode;
};

/** 助手消息末尾扩展区域的渲染上下文。 */
export interface AgentsChatAssistantMessageFooterContext {
  chatItem: ChatItem;
  conversationId?: string;
}

/**
 * 对话结束统计信息组件
 * 显示执行耗时和 token 总用量，以及复制回复的按钮
 */
function ChatEndMetrics({
  copyText,
  executionStats,
  viewAction,
  actions,
}: {
  copyText?: string;
  executionStats?: React.ReactNode;
  viewAction?: React.ReactNode;
  actions?: React.ReactNode;
}): React.ReactElement {
  const t = useAgentMessages("agents-chat-message");

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      toast.success(t.copied);
    } catch {
      toast.error(t.copyFailed);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground",
      )}
    >
      {executionStats}
      {copyText && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t.copyReply.value}
          className="ml-1 rounded p-0.5 transition-colors hover:text-foreground"
        >
          <CopyIcon size={12} />
        </button>
      )}
      {copyText && viewAction}
      {actions}
    </div>
  );
}

/**
 * 智能体聊天消息组件
 *
 * 负责渲染聊天消息列表，支持用户消息、助手消息、工具调用等多种类型
 * 包含工具事件的合并渲染逻辑，避免工具相关事件的重复渲染
 *
 * @author 思追(shaco)
 */
export function AgentsChatMessage(props: AgentsChatMessageProps) {
  const existingEventContext = useOptionalAiChatContextEvent();

  if (existingEventContext) {
    return <AgentsChatMessageContent {...props} />;
  }

  return <AgentsChatMessageWithFallbackEventContext {...props} />;
}

function AgentsChatMessageWithFallbackEventContext(
  props: AgentsChatMessageProps,
) {
  const fallbackEventContext = useAiChatContextEventValue(props.conversationId);

  return (
    <AiChatContextEventProvider value={fallbackEventContext}>
      <AgentsChatMessageContent {...props} />
    </AiChatContextEventProvider>
  );
}

function AgentsChatMessageContent({
  chatList,
  className,
  contentClassName,
  conversationId,
  onUserInputAnswer,
  onPlanApproval,
  hasOlderMessages,
  isLoadingOlder,
  onLoadOlderMessages,
  showMessageNavigator = false,
  showWorkingIndicator = true,
  messageView,
  onCancelQueuedMessage,
  renderAssistantMessageFooter,
  renderAssistantMessageStatsActions,
}: AgentsChatMessageProps) {
  const {
    mode: viewMode,
    canSwitch: canSwitchMessageView,
    changeMode: handleViewModeChange,
    scrollRootRef,
    preferenceError,
    clearPreferenceError,
  } = useMessageViewController(messageView);
  const messageViewScope = conversationId ?? "local";
  const [messageViewOverrides, setMessageViewOverrides] = useState<{
    scope: string;
    globalMode: AgentsChatMessageViewMode;
    values: Map<string, AgentsChatMessageViewMode>;
  }>(() => ({
    scope: messageViewScope,
    globalMode: viewMode,
    values: new Map(),
  }));
  const activeMessageViewOverrides =
    messageViewOverrides.scope === messageViewScope &&
    messageViewOverrides.globalMode === viewMode
      ? messageViewOverrides.values
      : undefined;
  const disclosure = useMessageDisclosureState(
    messageViewScope,
    chatList.map((item) => item.id),
    scrollRootRef,
    viewMode,
  );
  useLayoutEffect(() => {
    setMessageViewOverrides((previous) => {
      if (
        previous.scope === messageViewScope &&
        previous.globalMode === viewMode
      )
        return previous;
      return {
        scope: messageViewScope,
        globalMode: viewMode,
        values: new Map(),
      };
    });
  }, [messageViewScope, viewMode]);
  const handleMessageViewModeChange = useCallback(
    (messageId: string, nextMode: AgentsChatMessageViewMode) => {
      if (nextMode === "full") disclosure.resetFull(messageId);
      setMessageViewOverrides((previous) => {
        const values =
          previous.scope === messageViewScope &&
          previous.globalMode === viewMode
            ? new Map(previous.values)
            : new Map<string, AgentsChatMessageViewMode>();
        if (nextMode === viewMode) values.delete(messageId);
        else values.set(messageId, nextMode);
        return {
          scope: messageViewScope,
          globalMode: viewMode,
          values,
        };
      });
    },
    [disclosure, messageViewScope, viewMode],
  );
  const modeText = useAgentMessages("agents-chat-message");
  useEffect(() => {
    if (!preferenceError) return;
    toast.error(modeText.storageError.value, {
      description: modeText.storageErrorDescription.value,
    });
    clearPreferenceError();
  }, [preferenceError, clearPreferenceError, modeText]);

  const renderMessage = useCallback(
    (item: ChatItem) => (
      <ChatMessageRow
        item={item}
        conversationId={conversationId}
        onUserInputAnswer={onUserInputAnswer}
        onPlanApproval={onPlanApproval}
        showWorkingIndicator={showWorkingIndicator}
        viewMode={activeMessageViewOverrides?.get(item.id) ?? viewMode}
        onMessageViewModeChange={handleMessageViewModeChange}
        disclosure={disclosure}
        onCancelQueuedMessage={onCancelQueuedMessage}
        renderAssistantMessageFooter={renderAssistantMessageFooter}
        renderAssistantMessageStatsActions={renderAssistantMessageStatsActions}
      />
    ),
    [
      conversationId,
      onCancelQueuedMessage,
      onPlanApproval,
      onUserInputAnswer,
      showWorkingIndicator,
      viewMode,
      activeMessageViewOverrides,
      handleMessageViewModeChange,
      renderAssistantMessageFooter,
      renderAssistantMessageStatsActions,
      disclosure,
    ],
  );

  return (
    <div
      ref={scrollRootRef}
      className={cn(
        "relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden",
        className,
      )}
    >
      {canSwitchMessageView && (
        <div className="pointer-events-none absolute right-3 top-2 z-10 sm:right-8">
          <MessageViewSwitcher
            className="pointer-events-auto border bg-background/95 shadow-xs"
            value={viewMode}
            onValueChange={handleViewModeChange}
          />
        </div>
      )}
      <VirtualizedMessageList
        items={chatList}
        className="relative min-h-0 min-w-0 flex-1"
        contentClassName={contentClassName}
        hasOlderMessages={hasOlderMessages}
        isLoadingOlder={isLoadingOlder}
        onLoadOlderMessages={onLoadOlderMessages}
        showMessageNavigator={showMessageNavigator}
        renderItem={renderMessage}
      />
    </div>
  );
}

/**
 * 单条聊天消息行
 *
 * 对未加载事件内容的占位项（loaded=false）挂 IntersectionObserver，
 * 进入视口时通过 messageLoadRequestEvent 触发按需加载（复用 useChat.loadMessageEvents）。
 *
 * 覆盖以下场景：
 * 1. 初始化时 calcInitialLoadCount 只覆盖视口附近的消息，更早的占位项需要按需加载
 * 2. loadOlderMessages 加载新一页元数据后只批量加载尾部 loadCount 条，
 *    剩余占位项在用户继续向上滚动时按需加载
 *
 * @author 思追(shaco)
 */
const ChatMessageRow = memo(function ChatMessageRow({
  item,
  conversationId,
  onUserInputAnswer,
  onPlanApproval,
  showWorkingIndicator,
  viewMode,
  onMessageViewModeChange,
  disclosure,
  onCancelQueuedMessage,
  renderAssistantMessageFooter,
  renderAssistantMessageStatsActions,
}: {
  item: ChatItem;
  conversationId?: string;
  onUserInputAnswer?: (
    params: UserInputAnswerMessageParams,
  ) => Promise<UserInputAnswerOutput>;
  onPlanApproval?: (params: {
    messageId: string;
    approved: boolean;
    feedback?: string;
  }) => void;
  showWorkingIndicator: boolean;
  viewMode: AgentsChatMessageViewMode;
  onMessageViewModeChange: (
    messageId: string,
    mode: AgentsChatMessageViewMode,
  ) => void;
  disclosure: MessageDisclosureState;
  onCancelQueuedMessage?: (messageId: string) => Promise<void>;
  renderAssistantMessageFooter?: (
    context: AgentsChatAssistantMessageFooterContext,
  ) => React.ReactNode;
  renderAssistantMessageStatsActions?: (
    context: AgentsChatAssistantMessageFooterContext,
  ) => React.ReactNode;
}) {
  const access = useAiChatAccess();
  const t = useAgentMessages("agents-chat-message");
  const ref = useRef<HTMLDivElement>(null);
  const { messageLoadRequestEvent } = useAiChatContextEvent();
  const {
    id,
    loading,
    loaded,
    user,
    assistant,
    status,
    streamRecoveryState,
    renderVersion,
  } = item;
  const projection = buildAssistantTurnProjection(assistant, loading);
  const executionType = resolveConversationExecutionType(user, item.executionType);
  const isAsyncNotification = executionType === "ASYNC_TASK_NOTIFICATION";
  const isGoalContinuation = executionType === "GOAL_CONTINUATION";
  const isInternalFollowup = isAsyncNotification || isGoalContinuation;
  const [cancellingQueue, setCancellingQueue] = useState(false);
  const statsViewAction = (
    <MessageViewToggle
      value={viewMode}
      onValueChange={(mode) => onMessageViewModeChange(id, mode)}
    />
  );

  const cancelQueue = async () => {
    if (!onCancelQueuedMessage || cancellingQueue) return;
    access.requireAccess("execute");
    setCancellingQueue(true);
    try {
      await onCancelQueuedMessage(id);
    } catch (error) {
      console.error("取消排队消息失败", error);
      toast.error(t.cancelQueuedFailed);
    } finally {
      setCancellingQueue(false);
    }
  };

  useEffect(() => {
    if (loaded) return;
    const el = ref.current;
    if (!el || !conversationId) return;
    const chatContainer = el.closest<HTMLElement>("[data-chat-container]");
    const scrollContent =
      chatContainer?.querySelector<HTMLElement>("[data-chat-scroll]");
    const scrollContainer = scrollContent?.parentElement;
    if (!scrollContainer) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          messageLoadRequestEvent.emit({ conversationId, messageId: id });
          io.disconnect();
        }
      },
      { root: scrollContainer, rootMargin: "600px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loaded, id, conversationId, messageLoadRequestEvent]);

  const messageContent = (
    <div className="flex flex-col gap-4">
      {isAsyncNotification && (
        <div className="text-xs text-muted-foreground">{t.asyncFollowup}</div>
      )}
      {isGoalContinuation && (
        <div className="text-xs text-muted-foreground">{t.goalContinuation}</div>
      )}
      {user && !isInternalFollowup && (
        <Message from="user">
          <MessageContent>
            <UserMessageText text={user.text} />
          </MessageContent>
          <UserMessageAttachments attachments={user.attachments ?? []} />
        </Message>
      )}
      {status === ConversationMessageStatus.QUEUED && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ClockIcon className="size-3.5" />
          <span>{t.queued}</span>
          {access.decisionFor("execute") && (
            <PermissionExplanation
              decision={access.decisionFor("execute")!}
              subject={t.cancelQueued.value}
            />
          )}
          {onCancelQueuedMessage && !isInternalFollowup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={cancellingQueue || !access.canExecute}
              aria-label={t.cancelQueued.value}
              onClick={() => void cancelQueue()}
            >
              {cancellingQueue ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                t.cancelQueued
              )}
            </Button>
          )}
        </div>
      )}
      {status === ConversationMessageStatus.CANCELLED && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <XCircleIcon className="size-3.5" />
          <span>{t.cancelled}</span>
        </div>
      )}
      {loaded ? (
        assistant.length > 0 && (
          <AssistantMessageBlock
            key={`${id}-${renderVersion ?? 0}`}
            assistant={assistant}
            projection={projection}
            status={status}
            conversationId={conversationId}
            messageId={id}
            onUserInputAnswer={onUserInputAnswer}
            onPlanApproval={onPlanApproval}
            viewMode={viewMode}
            statsViewAction={statsViewAction}
            chatItem={item}
            disclosure={disclosure}
            footer={renderAssistantMessageFooter?.({
              chatItem: item,
              conversationId,
            })}
            statsActions={renderAssistantMessageStatsActions?.({
              chatItem: item,
              conversationId,
            })}
          />
        )
      ) : (
        <Message from="assistant">
          <MessageContent>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              <span>{t.messageLoading}</span>
            </div>
          </MessageContent>
        </Message>
      )}
      {loading &&
        status === ConversationMessageStatus.PENDING &&
        showWorkingIndicator &&
        !streamRecoveryState && (
          <ChatWorkingIndicator
            startedAt={item.startedAt}
            viewMode={viewMode}
            state={projection.workingState}
          />
        )}
    </div>
  );

  return (
    <div ref={ref} data-message-id={id}>
      {messageContent}
    </div>
  );
});

interface UserMessageTextProps {
  text?: string;
}

function UserMessageText({ text }: UserMessageTextProps) {
  const t = useAgentMessages("agents-chat-message");
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const updateOverflowState = useCallback(() => {
    if (isExpanded) return;

    const content = contentRef.current;
    if (!content) return;

    setIsOverflowing(content.scrollHeight > content.clientHeight + 1);
  }, [isExpanded]);

  useLayoutEffect(() => {
    updateOverflowState();
  }, [text, updateOverflowState]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const resizeObserver = new ResizeObserver(updateOverflowState);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [updateOverflowState]);

  const handleToggle = () => {
    setIsExpanded((expanded) => !expanded);
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div
        ref={contentRef}
        className={cn(
          "min-w-0 max-w-full leading-5 [overflow-wrap:anywhere]",
          !isExpanded && "max-h-40 overflow-hidden",
        )}
      >
        <MessageResponse>{text}</MessageResponse>
      </div>
      {isOverflowing && (
        <div
          className={cn(
            "relative flex w-full items-center",
            !isExpanded &&
              "-mt-6 bg-gradient-to-t from-secondary via-secondary/95 to-secondary/0 pt-6",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2.5 self-start bg-transparent hover:bg-foreground/10"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? t.collapseUserMessage.value
                : t.expandUserMessage.value
            }
            onClick={handleToggle}
          >
            {isExpanded ? t.collapseUserMessage : t.expandUserMessage}
            {isExpanded ? (
              <ChevronUpIcon data-icon="inline-end" />
            ) : (
              <ChevronDownIcon data-icon="inline-end" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * 对话执行中提示。
 *
 * 仅在消息尚未结束时挂载，通过每秒刷新当前时间实时展示已执行时长。
 */
function ChatWorkingIndicator({
  startedAt,
  viewMode,
  state,
}: {
  startedAt?: number;
  viewMode: AgentsChatMessageViewMode;
  state?: AssistantWorkingState;
}) {
  const t = useAgentMessages("agents-chat-message");
  const initialStartedAtRef = useRef(startedAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, MS_PER_SECOND);

    return () => window.clearInterval(timer);
  }, []);

  const duration = formatWorkingDuration(initialStartedAtRef.current, now);
  const workingText =
    viewMode === "full"
      ? t.working.value
      : getCompactWorkingText(state, {
          thinking: t.workingThinking.value,
          executingTools: t.workingExecutingTools.value,
          compressingContext: t.workingCompressingContext.value,
        });

  return (
    <span className="text-xs text-muted-foreground">
      <Shimmer as="span">{workingText}</Shimmer>
      &nbsp;&nbsp;
      <span>(&nbsp;{duration}&nbsp;)</span>
    </span>
  );
}

function getCompactWorkingText(
  state: AssistantWorkingState | undefined,
  text: {
    thinking: string;
    executingTools: string;
    compressingContext: string;
  },
): string {
  switch (state) {
    case "executing-tools":
      return text.executingTools;
    case "compressing-context":
      return text.compressingContext;
    case "thinking":
    default:
      return text.thinking;
  }
}

/**
 * 助手消息块组件
 *
 * 包裹 CitationContext.Provider，为引用渲染提供数据
 *
 * @author 思追(shaco)
 */
function AssistantMessageBlock({
  assistant,
  projection,
  status,
  conversationId,
  messageId,
  onUserInputAnswer,
  onPlanApproval,
  viewMode,
  statsViewAction,
  footer,
  statsActions,
  chatItem,
  disclosure,
}: {
  assistant: AssistantChatMessage[];
  projection: AssistantTurnProjection;
  status?: string;
  conversationId?: string;
  messageId: string;
  onUserInputAnswer?: (
    params: UserInputAnswerMessageParams,
  ) => Promise<UserInputAnswerOutput>;
  onPlanApproval?: (params: {
    messageId: string;
    approved: boolean;
    feedback?: string;
  }) => void;
  viewMode: AgentsChatMessageViewMode;
  statsViewAction?: React.ReactNode;
  footer?: React.ReactNode;
  statsActions?: React.ReactNode;
  chatItem: ChatItem;
  disclosure: MessageDisclosureState;
}) {
  const t = useAgentMessages("agents-chat-message");
  const { httpClient } = useAiChatContext();
  const fetchMetadata = useCitationMetadata(httpClient);
  const [citationSheetOpen, setCitationSheetOpen] = useState(false);
  const [activeCitationKeys, setActiveCitationKeys] = useState<CitationKey[]>(
    [],
  );

  const openCitationSheet = (keys: CitationKey[]) => {
    setActiveCitationKeys(keys);
    setCitationSheetOpen(true);
  };

  const citationValue = useCitationData(
    assistant,
    fetchMetadata,
    openCitationSheet,
  );
  const assistantText = projection.items
    .flatMap((item) =>
      item.kind === "reply"
        ? [item.events.map((event) => event.message).join("")]
        : [],
    )
    .join("\n\n");
  const hasManualInterruptEvent = assistant.some(
    (event) => event.type === AiChatEventTypeEnum.ManualInterrupt,
  );
  const messageInterrupted =
    status === ConversationMessageStatus.INTERRUPTED || hasManualInterruptEvent;
  const showInterruptIndicator =
    status === ConversationMessageStatus.INTERRUPTED &&
    !hasManualInterruptEvent;
  const endEvent = [...assistant]
    .reverse()
    .find((event): event is import("@lingya-ai/agents-sdk/browser").AiChatEndBriefEvent => !("rawJson" in event) && event.type === AiChatEventTypeEnum.End);
  const executionStats = (
    <TurnExecutionStats
      item={chatItem}
      endDuration={endEvent?.executionTimeMillis}
      usage={endEvent?.totalUsage}
    />
  );

  return (
    <CitationContext.Provider value={citationValue}>
      <Message from="assistant" className="gap-3">
        <AssistantTurnProcess
          projection={projection}
          executing={
            !endEvent &&
            (chatItem.loading ||
              status === ConversationMessageStatus.PENDING) &&
            (status === undefined || !isTerminalMessageStatus(status))
          }
          viewMode={viewMode}
          messageId={messageId}
          disclosure={disclosure}
          toolProps={{
            conversationId,
            messageId,
            messageInterrupted,
            onUserInputAnswer,
            onPlanApproval,
          }}
          renderStandalone={(event) => (
            <AssistantMessageContent
              item={event}
              conversationId={conversationId}
              copyText={
                event.type === AiChatEventTypeEnum.End
                  ? assistantText
                  : undefined
              }
              executionStats={event === endEvent ? executionStats : undefined}
              viewAction={event === endEvent ? statsViewAction : undefined}
              statsActions={event === endEvent ? statsActions : undefined}
            />
          )}
        />
        {showInterruptIndicator && (
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <PauseIcon className="size-3" />
            <span>{t.interrupted}</span>
            <span className="opacity-50">·</span>
            <span>{t.interruptedDescription}</span>
            {assistantText && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(assistantText);
                    toast.success(t.copied);
                  } catch {
                    toast.error(t.copyFailed);
                  }
                }}
                aria-label={t.copyReply.value}
                className="ml-1 rounded p-0.5 transition-colors hover:text-foreground"
              >
                <CopyIcon size={12} />
              </button>
            )}
          </div>
        )}
        {!endEvent && executionStats}
        {footer}
      </Message>
      <KnowledgeCitationSheet
        open={citationSheetOpen}
        activeKeys={activeCitationKeys}
        onOpenChange={setCitationSheetOpen}
      />
    </CitationContext.Provider>
  );
}

/**
 * 渲染助手消息内容
 * 仅处理非工具类事件，工具事件由 ToolEventsBlock 统一渲染
 *
 * @param props - 组件属性
 * @param props.item - 助手消息事件
 * @param props.copyText - 整条回复的完整文本，用于复制按钮
 * @returns 消息内容 JSX
 * @author 思追(shaco)
 */
function AssistantMessageContent({
  item,
  conversationId,
  copyText,
  executionStats,
  viewAction,
  statsActions,
}: {
  item: AssistantChatMessage;
  conversationId?: string;
  copyText?: string;
  executionStats?: React.ReactNode;
  viewAction?: React.ReactNode;
  statsActions?: React.ReactNode;
}) {
  const t = useAgentMessages("agents-chat-message");

  if ('rawJson' in item) return <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.rawJson}</pre>;
  switch (item.type) {
    case AiChatEventTypeEnum.CompressorContextStart:
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          <span>{t.compressingContext}</span>
        </div>
      );

    case AiChatEventTypeEnum.CompressorContextEnd:
      return (
        <Checkpoint>
          <CheckpointIcon />
          <CheckpointTrigger>{t.compressContext}</CheckpointTrigger>
        </Checkpoint>
      );

    case AiChatEventTypeEnum.Message:
      return (
        <MessageContent>
          <CitationMessageResponse>{item.message}</CitationMessageResponse>
        </MessageContent>
      );

    case AiChatEventTypeEnum.End:
      return (
        <div className="flex flex-col">
          {((item.artifacts?.length ?? 0) > 0 ||
            item.nonFileArtifacts.length > 0) && (
            <AssistantMessageArtifacts
              artifacts={item.artifacts ?? []}
              nonFileArtifacts={item.nonFileArtifacts}
              conversationId={conversationId}
            />
          )}
          <ChatEndMetrics
            copyText={copyText}
            executionStats={executionStats}
            viewAction={viewAction}
            actions={statsActions}
          />
        </div>
      );

    case AiChatEventTypeEnum.ManualInterrupt:
      return (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <PauseIcon className="size-3" />
            <span>{t.interrupted}</span>
            <span className="opacity-50">·</span>
            <span>{t.interruptedDescription}</span>
          </div>
        </div>
      );

    case AiChatEventTypeEnum.Error:
      return (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 pt-1 text-xs text-destructive">
            <XCircleIcon className="size-3" />
            <span>{item.message}</span>
          </div>
        </div>
      );

    case AiChatEventTypeEnum.CompactorWarning:
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 pt-1 text-xs",
            item.level === CompactorWarningLevelEnum.LOCKED
              ? "text-destructive"
              : "text-warning",
          )}
        >
          <AlertTriangleIcon className="size-3 shrink-0" />
          <span className="font-medium">
            {item.level === CompactorWarningLevelEnum.LOCKED
              ? t.compactorWarningLockedTitle.value
              : t.compactorWarningDegradeTitle.value}
          </span>
          <span className="opacity-70">·</span>
          <span>{item.warning}</span>
        </div>
      );

    default:
      return null;
  }
}
