"use client";
import { useConversationLifecycle } from "../hooks/use-chat/use-conversation-lifecycle";
import {
  ConversationArchiveNotice,
  ConversationLifecycleUnavailable,
} from "./conversation-archive-controls";
import { useAgentGoal } from "../hooks/use-chat/use-agent-goal";
import { useConversationMessageSync } from "../hooks/use-chat/use-conversation-message-sync";
import { AgentGoalPhase } from "../hooks/use-chat/agent-goal-schema";

import { usePendingPlanApproval } from "./use-pending-plan-approval";
import { usePlanModeConfigRefresh } from "./use-plan-mode-config-refresh";

import { useAiChatAccess } from "./use-ai-chat-access";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConversationEmptyState } from "../components/conversation";
import { Loader } from "../components/loader";
import { useChatStreamTransportPreference } from "../hooks/use-chat/chat-stream-transport";
import {
  AiChatEventTypeEnum,
  ToolCallStatusEnum,
} from "../hooks/use-chat/schema";
import {
  type ChatItem,
  type SendCallback,
  type UserChatQuery,
} from "../hooks/use-chat/types";
import { type AgentsConfig } from "../hooks/use-chat/use-agents-config";
import { useEffectiveAgentsConfig } from "../hooks/use-chat/use-effective-agents-config";
import {useChatClientCacheKey} from "../hooks/use-chat/use-chat-client-cache-key";
import { useChatReadiness } from "../hooks/use-chat/use-chat-readiness";
import { useChat } from "../hooks/use-chat/use-chat";
import { useSubagentTasks } from "../hooks/use-chat/use-subagent-tasks";
import { useConversationOperations } from "../hooks/use-chat/use-conversation-operations";
import {
  useSubmitPlanApproval,
  useSubmitUserInputAnswer,
  type UserInputAnswerMessageParams,
} from "../hooks/use-chat/use-hitl";
import {
  AgentsChatConfig,
  AgentsChatInput,
  type AgentsChatInputProps,
} from "./agents-chat-input";
import { ChatStreamStatusPanel } from "./chat-stream-status-panel";
import { shouldAutomaticallyLoadContextUsage } from "./context-compaction-command";
import {
  AgentsChatMessage,
  type AgentsChatAssistantMessageFooterContext,
} from "./agents-chat-message";
import { useMessageViewController } from "./message-view-controller";
import type { AgentsChatMessageViewOptions } from "./message-disclosure-policy";

export type {
  AgentsChatMessageViewMode,
  AgentsChatMessageViewOptions,
} from "./message-disclosure-policy";
export type { AgentsChatAssistantMessageFooterContext } from "./agents-chat-message";
import { AiChatConfigContextProvider } from "./config";
import { useAiChatContext } from "./context";
import { createMessageQueueView } from "./message-queue-view";
import { useRequest } from "../../api/hooks/use-request/index";
import { Button } from "../../ui/components/button";
import { Alert, AlertDescription } from "../../ui/components/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../ui/components/empty";
import { MessageSquare, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "../../ui/lib/utils";
import { toast } from "../../ui/components/sonner";
import { useAgentMessages } from "../../i18n/runtime";
import {
  AiChatContextEventProvider,
  useAiChatContextEventValue,
} from "./events";
import {
  AgentsChatWorkspaceLayout,
  type AgentsChatWorkspaceOptions,
} from "./agents-chat-workspace-layout";
import {
  WorkspaceControllerProvider,
  useWorkspaceController,
} from "./workspace-controller";
import {
  type AiChatEvent,
  type AiChatToolExecutionEvent,
  type Artifacts,
} from "../hooks/use-chat/schema";
import { findLatestTaskProgress } from "../hooks/use-chat/history-replay";
import type { WorkspaceNonFileArtifact } from "../hooks/use-chat/workspace-non-file-artifact-schema";

const CONTEXT_USAGE_POLLING_INTERVAL = 15_000;
const CONTEXT_USAGE_STALE_TIME = 1_000;

/** 获取最近一次正常结束消息的上下文窗口占用比例。 */
function getLatestMessageContextUsageRatio(
  chatList: readonly ChatItem[],
): number | null {
  for (
    let messageIndex = chatList.length - 1;
    messageIndex >= 0;
    messageIndex--
  ) {
    const assistantEvents = chatList[messageIndex]?.assistant;
    if (!assistantEvents) continue;

    for (
      let eventIndex = assistantEvents.length - 1;
      eventIndex >= 0;
      eventIndex--
    ) {
      const event = assistantEvents[eventIndex];
      if (event && !("rawJson" in event) && event.type === AiChatEventTypeEnum.End) {
        return event.messageContextUsageRatio ?? null;
      }
    }
  }

  return null;
}

function getTerminalWorkspaceArtifacts(event: AiChatEvent):
  | {
      terminalType: "end";
      artifacts: Artifacts[];
      nonFileArtifacts: WorkspaceNonFileArtifact[];
    }
  | undefined {
  if ("rawJson" in event || event.type !== AiChatEventTypeEnum.End) {
    return undefined;
  }

  return {
    terminalType: "end",
    artifacts: event.artifacts ?? [],
    nonFileArtifacts: event.nonFileArtifacts,
  };
}

/**
 * 智能体聊天组件属性
 */
export type AgentsChatProps = {
  /** 标准目标控制面默认启用，宿主可显式关闭。 */
  goal?: { enabled?: boolean };

  /**
   * 对话id
   */
  conversationId?: string;

  /**
   * 输入框相关属性
   */
  input: Pick<
    AgentsChatInputProps,
    | "placeholder"
    | "inputSuggestions"
    | "submissionBlocked"
    | "showContextWindowUsage"
    | "showContextCompactionCommand"
    | "renderHeader"
    | "showModelSelector"
    | "showRestart"
    | "showThinkingToggle"
    | "showAttachments"
    | "showWorkspace"
    | "workspaceLabel"
  >;

  /**
   * 是否为只读模式。只读模式仅展示历史消息，不显示输入框或待处理交互操作
   */
  readOnly?: boolean;

  /**
   * 空状态配置（可选）
   */
  emptyState?: {
    /** 空状态标题 */
    title?: string;
    /** 空状态描述 */
    description?: string;
    /** 空状态图标 */
    icon?: React.ReactNode;
    /** 空状态补充内容，例如任务建议和最近工作。 */
    content?: React.ReactNode;
    /** centered-composer 会把输入框放在首屏任务入口内。 */
    layout?: "default" | "centered-composer";
  };

  /** 配置已加载且无可用模型时替代聊天区，不影响加载和错误状态。 */
  noModelsFallback?: React.ReactNode;

  /** 按业务场景定制配置加载失败说明；未返回内容时展示接口错误消息。 */
  renderConfigErrorDescription?: (error: Error) => React.ReactNode;

  /** 指定场景配置缺失时保留历史和执行控制，并禁用新消息输入。 */
  allowHistoryOnConfigNotInitialized?: { errorMessage: string };

  /**
   * 容器类名（可选）
   */
  className?: string;

  /** 工作区展示配置；不传时使用 auto，根据聊天容器宽度在 split 与 Sheet 间切换。 */
  workspace?: AgentsChatWorkspaceOptions;

  /** 消息展示策略，默认使用重点模式并允许用户切换到全部视图。 */
  messageView?: AgentsChatMessageViewOptions;

  /** 在每条助手消息的末尾渲染业务扩展区域。 */
  renderAssistantMessageFooter?: (
    context: AgentsChatAssistantMessageFooterContext,
  ) => React.ReactNode;

  /** 在助手消息末尾统计行的复制按钮之后渲染业务扩展操作。 */
  renderAssistantMessageStatsActions?: (
    context: AgentsChatAssistantMessageFooterContext,
  ) => React.ReactNode;
};

export type AgentsChatInstance = {
  /** 重新开始对话 */
  onRestart: () => Promise<void>;
  /** 停止当前对话 */
  onStop: () => Promise<void>;
  /** 刷新智能体配置 */
  refreshConfig: () => void;
  /** 打开当前会话的工作区。 */
  openWorkspace: () => void;
  /** 使用当前配置提交一条宿主提供的消息。 */
  submitMessage: (text: string) => Promise<void>;
};

type AgentsChatInstanceControllerProps = {
  chatRef: React.ForwardedRef<AgentsChatInstance>;
  configProvided: boolean;
  onRestart: () => Promise<void>;
  onStop: () => Promise<void>;
  refreshConfig: () => void;
  submitMessage: (text: string) => Promise<void>;
};

/**
 * 将工作区的布局决策保留在 AgentsChat 内部，并向外暴露统一的实例方法。
 */
function AgentsChatInstanceController({
  chatRef,
  configProvided,
  onRestart,
  onStop,
  refreshConfig,
  submitMessage,
}: AgentsChatInstanceControllerProps) {
  const { openWorkspace: handleOpenWorkspace } = useWorkspaceController();

  useImperativeHandle(
    chatRef,
    () => ({
      onRestart,
      onStop,
      refreshConfig: configProvided ? () => undefined : refreshConfig,
      openWorkspace: handleOpenWorkspace,
      submitMessage,
    }),
    [
      configProvided,
      handleOpenWorkspace,
      onRestart,
      onStop,
      refreshConfig,
      submitMessage,
    ],
  );

  return null;
}

const readOnlyChatConfig = {
  modelConfig: {
    defaultModel: null,
    modelKeyGroups: [],
  },
  supportAttachmentExt: [],
  maxAttachmentCount: 0,
} satisfies AgentsConfig;

/**
 * 智能体聊天组件
 *
 * 整合了消息列表和输入框，提供完整的聊天界面
 *
 * @param props - 组件属性
 * @returns 聊天界面 JSX
 * @author 思追(shaco)
 */
export const AgentsChat = forwardRef<AgentsChatInstance, AgentsChatProps>(
  (
    {
      conversationId,
      emptyState,
      noModelsFallback,
      input,
      className,
      readOnly: requestedReadOnly = false,
      goal: goalOptions,
      renderConfigErrorDescription,
      allowHistoryOnConfigNotInitialized,
      workspace,
      messageView,
      renderAssistantMessageFooter,
      renderAssistantMessageStatsActions,
    },
    ref,
  ) => {
    const access = useAiChatAccess();
    const requireChatAccess = access.requireAccess;
    const t = useAgentMessages("agents-chat");

    const {
      httpClient,
      streamTransport: configuredStreamTransport,
      onConversationSubmitted: parentOnConversationSubmitted,
      onReadinessChange,
      onConversationStart: parentOnConversationStart,
      onConversationComplete: parentOnConversationComplete,
      onBeforeSubmit,
      onBeforeGoalCreate,
      onConversationCreated: parentOnConversationCreated,
      clearPendingConversationGroupId,
      onUserInputAnswer: externalOnUserInputAnswer,
      onPlanApproval: externalOnPlanApproval,
      onConversationIdChange,
      onChatListChange,
      onToolCall: externalOnToolCall,
    } = useAiChatContext();
    const {
      transport: preferredStreamTransport,
      setTransport: setPreferredStreamTransport,
      error: streamTransportPreferenceError,
      clearError: clearStreamTransportPreferenceError,
    } = useChatStreamTransportPreference();
    const streamTransport =
      configuredStreamTransport ?? preferredStreamTransport;
    const [dismissedBufferedDetection, setDismissedBufferedDetection] =
      useState<number>();

    useEffect(() => {
      if (!streamTransportPreferenceError) return;
      toast.error(t.streamTransportPreferenceSaveFailed.value);
      clearStreamTransportPreferenceError();
    }, [
      clearStreamTransportPreferenceError,
      streamTransportPreferenceError,
      t.streamTransportPreferenceSaveFailed.value,
    ]);

    const {
      isInit,
      chatList,
      asyncTasks,
      conversationId: currentConversationId,
      handleSend,
      handleRestart,
      handleStop,
      cancelQueuedMessage,
      isResponding,
      loadOlderMessages,
      loadMessageEvents,
      isLoadingOlder,
      hasOlderMessages,
      streamStatus,
      runStreamProbe,
      messageSyncAnchor,
      synchronizeMessages,
    } = useChat({
      conversationId: conversationId,
      readEnabled: access.canRead,
      httpClient: httpClient,
      streamTransport: configuredStreamTransport,
    });

    const lifecycle = useConversationLifecycle({
      httpClient,
      conversationId: currentConversationId,
      enabled:
        !requestedReadOnly &&
        access.canRead &&
        Boolean(conversationId || (!isResponding && chatList.length)),
      allowMissing: !conversationId,
    });
    const readOnly = requestedReadOnly || lifecycle.blocked;

    const subagents = useSubagentTasks({
      httpClient,
      conversationId: currentConversationId,
      ready: access.canRead && !isInit,
      executionActive: isResponding,
    });

    const visibleStreamStatus =
      streamTransport === "ws" &&
      (streamStatus.kind === "checking" || streamStatus.kind === "degraded")
        ? ({ kind: "hidden" } as const)
        : streamStatus;
    const bufferedDetection =
      visibleStreamStatus.kind !== "hidden" &&
      visibleStreamStatus.healthStatus === "buffered"
        ? visibleStreamStatus.detectedAt
        : undefined;
    const showTransportSwitch =
      configuredStreamTransport === undefined &&
      streamTransport === "sse" &&
      bufferedDetection !== undefined &&
      dismissedBufferedDetection !== bufferedDetection;
    const handleSwitchToWebSocket = useCallback(() => {
      if (setPreferredStreamTransport("ws")) {
        setDismissedBufferedDetection(bufferedDetection);
      }
    }, [bufferedDetection, setPreferredStreamTransport]);
    const handleContinueSse = useCallback(() => {
      if (setPreferredStreamTransport("sse")) {
        setDismissedBufferedDetection(bufferedDetection);
      }
    }, [bufferedDetection, setPreferredStreamTransport]);

    // 新会话使用 Agent 配置；历史会话额外恢复最近一次使用的模型和思考模式。
    const {
      config: fetchedAgentsConfig,
      loading: configLoading,
      error: configError,
      refreshConfig,
      rememberConversationModel,
      planMode: serverPlanMode,
      thinking: serverThinking,
      refreshConversationConfig,
    } = useEffectiveAgentsConfig({
      httpClient,
      conversationId: currentConversationId,
      enabled: !readOnly && access.canRead,
    });
    const agentsConfig = fetchedAgentsConfig || readOnlyChatConfig;
    const goalEnabled =
      !readOnly &&
      access.canRead &&
      access.canExecute &&
      goalOptions?.enabled !== false &&
      Boolean(fetchedAgentsConfig?.goal?.supported);
    const goalController = useAgentGoal({
      httpClient,
      conversationId: currentConversationId,
      enabled: goalEnabled,
      executionActive: isResponding,
      requireAccess: () => requireChatAccess("execute"),
    });
    const goalMessageSync = useConversationMessageSync({
      httpClient,
      conversationId: currentConversationId,
      ready:
        goalEnabled &&
        !isInit &&
        messageSyncAnchor?.conversationId === currentConversationId,
      initialCursorMessageId: messageSyncAnchor?.messageId,
      fast:
        isResponding || goalController.goal?.phase === AgentGoalPhase.Active,
      refreshKey: goalController.invalidated,
      onSynchronize: synchronizeMessages,
    });
    const chatGoalController = goalEnabled
      ? {
          ...goalController,
          error: goalController.error ?? goalMessageSync.error ?? null,
          refresh: async () => {
            await goalController.refresh();
            await goalMessageSync.refreshAsync();
          },
        }
      : undefined;
    const configContextValue = useMemo(
      () => ({ config: agentsConfig }),
      [agentsConfig],
    );
    const renderedConfigErrorDescription = configError
      ? renderConfigErrorDescription?.(configError)
      : undefined;
    const configErrorDescription = configError
      ? (renderedConfigErrorDescription ??
        (configError.message.trim() || t.configUnavailableDescription.value))
      : undefined;
    const canKeepHistoryWithoutConfig = Boolean(
      configError &&
        !fetchedAgentsConfig &&
        allowHistoryOnConfigNotInitialized?.errorMessage ===
          configError.message,
    );

    const eventValue = useAiChatContextEventValue(currentConversationId);
    const showContextWindowUsage = input.showContextWindowUsage ?? false;
    const {
      compactConversation,
      getConversationContextUsage,
      moveConversation,
    } = useConversationOperations({ httpClient });
    const contextUsageCacheKey=useChatClientCacheKey(httpClient,"conversation-context-usage",currentConversationId??null);
    const fetchConversationContextUsage = useCallback(async () => {
      if (!currentConversationId || !access.canRead || readOnly) return null;

      return {
        conversationId: currentConversationId,
        usage: await getConversationContextUsage(currentConversationId),
      };
    }, [
      currentConversationId,
      getConversationContextUsage,
      access.canRead,
      readOnly,
    ]);
    const {
      data: conversationContextUsageResult,
      loading: conversationContextUsageLoading,
      refreshAsync: refreshConversationContextUsage,
    } = useRequest(fetchConversationContextUsage, {
      ready:
        access.canRead &&
        shouldAutomaticallyLoadContextUsage({
          conversationId: currentConversationId,
          readOnly,
          showContextWindowUsage,
        }),
      cacheKey: currentConversationId
        ? contextUsageCacheKey
        : undefined,
      cacheTime: CONTEXT_USAGE_POLLING_INTERVAL,
      staleTime: CONTEXT_USAGE_STALE_TIME,
      refreshDeps: [currentConversationId, httpClient],
      pollingInterval:
        showContextWindowUsage && isResponding
          ? CONTEXT_USAGE_POLLING_INTERVAL
          : undefined,
      pollingWhenHidden: false,
    });
    const wasRespondingRef = useRef(isResponding);

    // 对话结束后立即同步服务端的最终上下文用量，补齐流式结束事件与实际会话视图之间的时间差。
    useEffect(() => {
      if (
        showContextWindowUsage &&
        wasRespondingRef.current &&
        !isResponding &&
        currentConversationId
      ) {
        void refreshConversationContextUsage().catch(() => {
          // 上下文用量刷新失败不影响已完成的对话；下次轮询或用户手动刷新会再次尝试。
        });
      }
      wasRespondingRef.current = isResponding;
    }, [
      currentConversationId,
      isResponding,
      refreshConversationContextUsage,
      showContextWindowUsage,
    ]);

    // HITL hooks — 通过 httpClient 直接调用后端 API
    const submitUserInputAnswer = useSubmitUserInputAnswer(httpClient);
    const submitPlanApproval = useSubmitPlanApproval(httpClient);

    // 同步当前 conversationId 到聊天上下文，并通知外部监听方
    useEffect(() => {
      onConversationIdChange?.(currentConversationId);
      eventValue.conversationIdChangeEvent.emit({
        conversationId: currentConversationId,
      });
    }, [
      currentConversationId,
      eventValue.conversationIdChangeEvent,
      onConversationIdChange,
    ]);

    useEffect(() => {
      onChatListChange?.(chatList);
      eventValue.chatListChangeEvent.emit({ chatList });
    }, [chatList, onChatListChange]);

    // 订阅导航器按需加载请求
    eventValue.messageLoadRequestEvent.useSubscription(
      (e) => void loadMessageEvents(e.messageId),
    );

    // 订阅加载更早消息请求
    eventValue.loadOlderMessagesRequestEvent.useSubscription(() => {
      if (access.canRead) void loadOlderMessages();
    });

    /**
     * 从 chatList 中查找当前轮次的任务进度扩展
     *
     * 后端 taskProgress 携带的是当前轮次的完整任务快照，任务计划在用户发来新消息时作废，
     * 因此只看最后一条消息的事件，取其中最后一次快照即可，无需增量合并，也不会回溯上一轮。
     *
     * 历史回放时 useChat.batchLoadEvents 会把历史 ToolExecution 事件填入 chatItem.assistant，
     * 因此刷新页面后此函数仍能取到正确的当前状态。
     */
    const latestTaskProgress = useMemo(
      () => findLatestTaskProgress(chatList),
      [chatList],
    );
    const messageQueueView = useMemo(
      () => createMessageQueueView(chatList),
      [chatList],
    );
    const awaitingPlanApproval = usePendingPlanApproval({
      httpClient,
      conversationId: currentConversationId,
      chatList,
      enabled: !readOnly && access.canRead,
    });
    usePlanModeConfigRefresh({
      conversationId: currentConversationId,
      chatList,
      isResponding,
      awaitingPlanApproval,
      refreshConversationConfig,
    });
    const renderedChatList = readOnly
      ? chatList
      : messageQueueView.visibleMessages;
    const queuedMessages = readOnly ? [] : messageQueueView.queuedMessages;
    const currentConversationContextUsage =
      currentConversationId &&
      conversationContextUsageResult?.conversationId === currentConversationId
        ? conversationContextUsageResult.usage
        : undefined;
    const messageContextUsageRatio = currentConversationContextUsage
      ? currentConversationContextUsage.activeUsageRatio
      : getLatestMessageContextUsageRatio(chatList);

    useChatReadiness(
      currentConversationId,
      chatList,
      isInit ||
        (!readOnly &&
          (configLoading || Boolean(configError && !fetchedAgentsConfig))),
      onReadinessChange,
    );

    /**
     * 发送消息
     * @param query - 用户查询内容
     * @param config - 聊天配置（模型等）
     * @param callbacks - 回调函数（来自输入组件）
     */
    const onSubmit = async (
      query: UserChatQuery,
      config: AgentsChatConfig,
      callbacks?: SendCallback,
    ) => {
      try {
        if (readOnly) return;
        requireChatAccess("submit");
        const conversationStartInfo = {
          firstUserMessage: query.query ?? "",
          isFirstMessage: chatList.length === 0,
        };
        const prepared = query.goalMode
          ? await (onBeforeGoalCreate ?? onBeforeSubmit)?.(
              currentConversationId,
            )
          : await onBeforeSubmit?.(currentConversationId);
        if (
          prepared?.conversationId &&
          prepared.conversationId !== currentConversationId
        ) {
          parentOnConversationCreated?.(prepared.conversationId);
        }
        requireChatAccess("submit");
        eventValue.beforeSubmitEvent.emit();

        // 拼装后端 chatModelSpec（ChatModelSpec）：keyGroupId + model + thinking
        const chatModelSpec = config.model
          ? {
              keyGroupId: config.model.keyGroupId,
              model: config.model.model,
              thinking: config.thinking,
            }
          : undefined;
        const mergedCallbacks: SendCallback = {
          onConversationSubmitted: async (cId, mId) => {
            let assignedGroupId: number | undefined;
            if (prepared?.conversationGroupId !== undefined) {
              try {
                await moveConversation(cId, prepared.conversationGroupId);
                assignedGroupId = prepared.conversationGroupId;
              } catch (error) {
                // 消息已被后端接受；归组失败不能阻断已开始的聊天流程。
                console.error("新会话归组失败:", error);
              } finally {
                clearPendingConversationGroupId(prepared.conversationGroupId);
              }
            }
            await callbacks?.onConversationSubmitted?.(
              cId,
              mId,
              assignedGroupId,
            );
            await parentOnConversationSubmitted?.(cId, mId, assignedGroupId);
          },
          onConversationStart: async (cId, mId) => {
            rememberConversationModel(cId, chatModelSpec, config.planMode);
            await callbacks?.onConversationStart?.(cId, mId);
            await parentOnConversationStart?.(cId, mId, conversationStartInfo);
            eventValue.conversationStartEvent.emit({
              conversationId: cId,
              messageId: mId,
            });
          },
          onConversationComplete: async (hasError, cId, mId, errorMessage) => {
            await callbacks?.onConversationComplete?.(
              hasError,
              cId,
              mId,
              errorMessage,
            );
            await parentOnConversationComplete?.(
              hasError,
              cId,
              mId,
              errorMessage,
            );
            eventValue.conversationCompleteEvent.emit({
              hasError,
              conversationId: cId,
              messageId: mId,
              errorMessage,
            });
          },
          onConsumeEvent: async (conversationId, messageId, event) => {
            await callbacks?.onConsumeEvent?.(conversationId, messageId, event);
            // 保留既有工具调用通知，并向使用方透传事件所属消息。
            if (event.type === AiChatEventTypeEnum.ToolExecution) {
              const toolEvent = event as AiChatToolExecutionEvent;
              externalOnToolCall?.(toolEvent, { conversationId, messageId });
              eventValue.toolCallEvent.emit({ event: toolEvent });
              if (
                toolEvent.toolName === "subagent" &&
                toolEvent.status === ToolCallStatusEnum.Success
              ) {
                void subagents.refresh();
              }
            }

            const terminalWorkspaceArtifacts =
              getTerminalWorkspaceArtifacts(event);
            if (terminalWorkspaceArtifacts) {
              eventValue.terminalWorkspaceArtifactsEvent.emit({
                conversationId,
                messageId,
                ...terminalWorkspaceArtifacts,
              });
            }
          },
        };
        await handleSend(
          {
            ...query,
            chatModelSpec,
            planMode: config.planMode ?? query.planMode,
            goalMode: config.goalMode ?? query.goalMode ?? false,
          },
          mergedCallbacks,
          {
            conversationId: prepared?.conversationId,
          },
        );
      } catch (error) {
        void lifecycle.refresh();
        console.error("发送消息失败:", error);
        toast.error(t.sendMessageFailed);
        // POST 尚未被后端接纳时没有产生一次 Agent 执行，不能伪造完成回调。
        throw error;
      }
    };

    const submitMessage = useCallback(
      async (text: string) => {
        if (readOnly) return;
        if (!fetchedAgentsConfig || canKeepHistoryWithoutConfig) {
          toast.error(configErrorDescription ?? t.configUnavailableTitle.value);
          return;
        }
        if (!text.trim()) return;
        await onSubmit({ query: text }, { thinking: false });
      },
      [
        readOnly,
        canKeepHistoryWithoutConfig,
        configErrorDescription,
        fetchedAgentsConfig,
        onSubmit,
        t.configUnavailableTitle.value,
      ],
    );

    const cid = currentConversationId ?? "";
    const handleLoadOlderMessages = useCallback(() => {
      if (!currentConversationId) return;
      eventValue.loadOlderMessagesRequestEvent.emit({
        conversationId: currentConversationId,
      });
    }, [currentConversationId, eventValue.loadOlderMessagesRequestEvent]);
    const handleUserInputAnswer = useCallback(
      async (params: UserInputAnswerMessageParams) => {
        requireChatAccess("execute");
        const fullParams = { ...params, conversationId: cid };
        const result = await (externalOnUserInputAnswer
          ? externalOnUserInputAnswer(fullParams)
          : submitUserInputAnswer(fullParams));
        if (result.success) {
          eventValue.userInputAnswerEvent.emit(fullParams);
        }
        return result;
      },
      [
        cid,
        eventValue.userInputAnswerEvent,
        externalOnUserInputAnswer,
        submitUserInputAnswer,
        requireChatAccess,
      ],
    );
    const handlePlanApproval = useCallback(
      (params: { messageId: string; approved: boolean; feedback?: string }) => {
        requireChatAccess("execute");
        const fullParams = { ...params, conversationId: cid };
        if (externalOnPlanApproval) externalOnPlanApproval(fullParams);
        else void submitPlanApproval(fullParams);
        eventValue.planApprovalEvent.emit(fullParams);
      },
      [
        cid,
        eventValue.planApprovalEvent,
        externalOnPlanApproval,
        submitPlanApproval,
        requireChatAccess,
      ],
    );
    const {
      mode: messageViewMode,
      canSwitch: canSwitchMessageView,
      changeMode: handleMessageViewModeChange,
      scrollRootRef: messageViewRootRef,
      preferenceError,
      clearPreferenceError,
    } = useMessageViewController(messageView, true);
    useEffect(() => {
      if (!preferenceError) return;
      toast.error(t.storageError.value, {
        description: t.storageErrorDescription.value,
      });
      clearPreferenceError();
    }, [preferenceError, clearPreferenceError, t]);

    // 等待配置加载完成
    if (!readOnly && configLoading) {
      return (
        <div
          className={cn(
            "flex flex-col flex-1 overflow-hidden min-w-0",
            className,
          )}
        >
          <div className="flex flex-1 items-center justify-center">
            <Loader />
          </div>
        </div>
      );
    }

    // 首次配置加载失败时不挂载会话和输入框，避免用户误以为仍可发送消息。
    // 已经持有配置的后台刷新失败则继续使用旧配置，不中断正在进行的会话。
    if (
      !readOnly &&
      configError &&
      !fetchedAgentsConfig &&
      !canKeepHistoryWithoutConfig
    ) {
      return (
        <div className={cn("flex min-w-0 flex-1 overflow-hidden", className)}>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="text-destructive">
                <TriangleAlert />
              </EmptyMedia>
              <EmptyTitle>{t.configUnavailableTitle}</EmptyTitle>
              <EmptyDescription>{configErrorDescription}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={refreshConfig}>
                <RefreshCw data-icon="inline-start" />
                {t.retryConfig}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      );
    }

    if (
      !readOnly &&
      fetchedAgentsConfig &&
      noModelsFallback !== undefined &&
      !fetchedAgentsConfig.modelConfig.modelKeyGroups.some(
        (group) => group.models.length > 0,
      )
    ) {
      return (
        <div
          className={cn("flex min-h-0 min-w-0 flex-1 overflow-auto", className)}
        >
          {noModelsFallback}
        </div>
      );
    }

    const centeredComposer =
      !readOnly &&
      !isInit &&
      chatList.length === 0 &&
      emptyState?.layout === "centered-composer";

    return (
      <AiChatConfigContextProvider value={configContextValue}>
        <AiChatContextEventProvider value={eventValue}>
          <WorkspaceControllerProvider
            subagents={access.canRead ? subagents : undefined}
            goal={
              chatGoalController && fetchedAgentsConfig?.goal
                ? {
                    controller: chatGoalController,
                    config: fetchedAgentsConfig.goal,
                  }
                : undefined
            }
            readOnly={readOnly}
          >
            <AgentsChatWorkspaceLayout
              workspace={workspace}
              className={className}
            >
              <AgentsChatInstanceController
                chatRef={ref}
                configProvided={readOnly}
                onRestart={async () => {
                  if (readOnly) return;
                  requireChatAccess("submit");
                  await handleRestart();
                }}
                onStop={async () => {
                  requireChatAccess("execute");
                  await handleStop();
                }}
                refreshConfig={refreshConfig}
                submitMessage={submitMessage}
              />
              <div
                ref={messageViewRootRef}
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                  centeredComposer &&
                    "justify-center overflow-y-auto py-8 sm:py-12",
                )}
              >
                {lifecycle.unavailable && (
                  <ConversationLifecycleUnavailable
                    onRetry={() => void lifecycle.refresh()}
                  />
                )}
                {lifecycle.archived && (
                  <ConversationArchiveNotice
                    canRestore={
                      access.canWrite && access.canExecute && !requestedReadOnly
                    }
                    restoring={lifecycle.restoring}
                    onRestore={() =>
                      void lifecycle.restore().catch(() => undefined)
                    }
                  />
                )}
                {canKeepHistoryWithoutConfig && configError && (
                  <div className="px-3 pt-3 sm:px-8">
                    <Alert variant="destructive">
                      <AlertDescription className="flex items-center justify-between gap-3">
                        <span>{configErrorDescription}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshConfig}
                        >
                          {t.retryConfig}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                {isInit ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader />
                  </div>
                ) : chatList.length === 0 ? (
                  <ConversationEmptyState
                    className={cn(
                      "flex-1",
                      centeredComposer && "h-auto flex-none p-0 pb-7",
                    )}
                    icon={
                      emptyState?.icon ?? <MessageSquare className="size-12" />
                    }
                    title={emptyState?.title ?? t.startConversation.value}
                    description={
                      emptyState?.description ?? t.startConversationDesc.value
                    }
                  />
                ) : renderedChatList.length > 0 ? (
                  <AgentsChatMessage
                    chatList={renderedChatList}
                    contentClassName="px-3 sm:px-8 pt-2 pb-6"
                    conversationId={currentConversationId}
                    messageView={{
                      mode: messageViewMode,
                      switchable: readOnly && canSwitchMessageView,
                      onModeChange: readOnly
                        ? handleMessageViewModeChange
                        : undefined,
                    }}
                    showMessageNavigator
                    hasOlderMessages={hasOlderMessages}
                    isLoadingOlder={isLoadingOlder}
                    onLoadOlderMessages={handleLoadOlderMessages}
                    onUserInputAnswer={
                      readOnly || !access.canExecute
                        ? undefined
                        : handleUserInputAnswer
                    }
                    onPlanApproval={
                      readOnly || !access.canExecute
                        ? undefined
                        : handlePlanApproval
                    }
                    renderAssistantMessageFooter={renderAssistantMessageFooter}
                    renderAssistantMessageStatsActions={
                      renderAssistantMessageStatsActions
                    }
                  />
                ) : (
                  <div className="min-h-0 flex-1" />
                )}

                {!readOnly && (
                  <div className="px-3 py-1 sm:px-8">
                    <div className="mx-auto w-full max-w-3xl">
                      <ChatStreamStatusPanel
                        status={visibleStreamStatus}
                        onProbe={runStreamProbe}
                        showTransportSwitch={showTransportSwitch}
                        onSwitchToWebSocket={handleSwitchToWebSocket}
                        onContinueSse={handleContinueSse}
                        className="mb-2"
                      />
                      <AgentsChatInput
                        initialThinking={serverThinking}
                        {...input}
                        submissionBlocked={
                          input.submissionBlocked || canKeepHistoryWithoutConfig
                        }
                        serverPlanMode={serverPlanMode}
                        awaitingPlanApproval={awaitingPlanApproval}
                        goalController={chatGoalController}
                        goalConfig={
                          goalEnabled
                            ? (fetchedAgentsConfig?.goal ?? undefined)
                            : undefined
                        }
                        isResponding={isResponding}
                        onStop={async () => {
                          requireChatAccess("execute");
                          await handleStop();
                        }}
                        onRestart={async () => {
                          requireChatAccess("submit");
                          await handleRestart();
                        }}
                        onSubmit={onSubmit}
                        queuedMessages={queuedMessages}
                        asyncTasks={asyncTasks}
                        conversationId={currentConversationId}
                        onCancelQueuedMessage={async (id) => {
                          requireChatAccess("execute");
                          await cancelQueuedMessage(id);
                        }}
                        taskProgress={latestTaskProgress}
                        enableSpeech={false}
                        attachments={agentsConfig.supportAttachmentExt}
                        messageContextUsageRatio={messageContextUsageRatio}
                        contextUsageLoading={conversationContextUsageLoading}
                        onRefreshContext={
                          currentConversationId
                            ? async () => {
                                await refreshConversationContextUsage();
                              }
                            : undefined
                        }
                        onCompactContext={
                          currentConversationId
                            ? async () => {
                                requireChatAccess("execute");
                                await compactConversation(
                                  currentConversationId,
                                );
                                await refreshConversationContextUsage().catch(
                                  () => {
                                    // 压缩已完成；刷新失败不应将压缩操作误报为失败。
                                  },
                                );
                              }
                            : undefined
                        }
                        messageView={
                          canSwitchMessageView
                            ? {
                                mode: messageViewMode,
                                onModeChange: handleMessageViewModeChange,
                              }
                            : undefined
                        }
                      />
                      {centeredComposer && emptyState?.content && (
                        <div className="mt-7">{emptyState.content}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </AgentsChatWorkspaceLayout>
          </WorkspaceControllerProvider>
        </AiChatContextEventProvider>
      </AiChatConfigContextProvider>
    );
  },
);
