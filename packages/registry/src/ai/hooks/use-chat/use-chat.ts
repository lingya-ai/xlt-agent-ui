"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentMessages } from "../../../i18n/runtime";
import { toast } from "sonner";
import { produce } from "immer";
import {
  findLatestChatStreamRecoveryState,
  resolveChatStreamStatus,
  type ChatStreamAggregateStatus,
} from "./chat-stream-status";
import type {
  ChatItem,
  SendCallback,
  UseChatOptions,
  UserChatQuery,
} from "./types";
import { resolveConversationExecutionType } from "./conversation-execution-type";
import {ConversationMessageStatus, hasReplayableMessageEvents, type ConversationMessageOutput} from "./conversation-message";
import { BATCH_MAX_SIZE, useChatEventsBatch } from "./use-chat-events-batch";
import { useChatMessages } from "./use-chat-messages";
import {
  replaceStringWithValues,
  useCheckPromptVariables,
} from "./use-check-prompt-variables";
import { useConsumeEvent } from "./use-consume-event";
import { useConversationMessages } from "./use-conversation-messages";
import {
  AiChatEventTypeEnum,
  type AiChatBaseResponse,
} from "./schema";
import { MessageLoadCoordinator } from "./message-load-coordinator";
import { resolveMessageDispatchAction } from "./message-dispatch-state";
import { useAgentAsyncTasks } from "./use-agent-async-tasks";
import type { AgentAsyncTask } from "./use-agent-async-tasks";
import {useAiChatRequestSignal} from "../../agents/context";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import { useChatStreamTransportPreference } from "./chat-stream-transport";
import {
  pickMessageStatistics,
  type MessageStatistics,
} from "./message-metadata";

/** 消息列表分页大小 */
const MESSAGE_PAGE_SIZE = 30;

/** 每个处理步骤预估占用的像素高度 */
const STEP_HEIGHT_PX = 80;

/** 排队消息状态轮询间隔。 */
const QUEUED_MESSAGE_POLLING_INTERVAL = 1000;

export type SendOptions = {
  /** 在发送前已经由业务侧准备好的会话 ID。 */
  conversationId?: string;
};

export type SendFunction = (
  query: UserChatQuery,
  callbacks?: SendCallback,
  options?: SendOptions,
) => Promise<AiChatBaseResponse>;

export type UseChatReturn = {
  /** 目标首次创建后接管会话，不伪造聊天提交回调。 */
  adoptConversation: (conversationId: string) => void;
  /** 公开消息同步的初始化游标。 */
  messageSyncAnchor: AsyncTaskSyncAnchor | null;
  /** 合并后台产生的公开消息，复用流与历史加载所有权。 */
  synchronizeMessages: (
    messages: ConversationMessageOutput[],
  ) => Promise<void | false>;
  /** 当前是否属于初始化状态 */
  isInit: boolean;
  /** 聊天记录列表 */
  chatList: ChatItem[];
  /** 当前会话的异步任务列表 */
  asyncTasks: AgentAsyncTask[];
  /** 设置聊天记录列表 */
  setChatList: (chatList: ChatItem[]) => void;
  /** 当前对话ID */
  conversationId: string | undefined;
  /** SSE 已连接或后端仍有 PENDING 消息 */
  isResponding: boolean;
  /** 当前会话是否还有等待执行的消息。 */
  hasQueuedMessages: boolean;
  /** 发送消息 */
  handleSend: SendFunction;
  /** 重新开始对话 */
  handleRestart: () => Promise<void>;
  /** 停止当前对话 */
  handleStop: () => Promise<void>;
  /** 取消一条尚未开始执行的排队消息。 */
  cancelQueuedMessage: (messageId: string) => Promise<void>;
  /** 加载更早的历史消息 */
  loadOlderMessages: () => Promise<void>;
  /** 按需加载指定消息的事件内容 */
  loadMessageEvents: (messageId: string) => Promise<void>;
  /** 是否正在加载更早消息 */
  isLoadingOlder: boolean;
  /** 是否还有更早的消息可加载 */
  hasOlderMessages: boolean;
  /** 聚合后的 AI 回复连接与恢复状态。 */
  streamStatus: ChatStreamAggregateStatus;
  /** 主动重新检测当前网络的流式响应能力。 */
  runStreamProbe: () => Promise<void>;
};

type QueuedMessageTask = {
  conversationId: string;
  callbacks: SendCallback;
};

type AsyncTaskSyncAnchor = {
  conversationId: string;
  messageId: string | null;
};

/**
 * 根据窗口高度和消息的 processingSteps 动态计算需要加载事件的消息数量
 * 从消息列表末尾向前累加 processingSteps，直到总高度超过窗口高度
 */
function calcInitialLoadCount(
  messages: ConversationMessageOutput[],
  windowHeight: number,
): number {
  let accumulatedHeight = 0;
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const steps = messages[i]?.processingSteps ?? 1;
    accumulatedHeight += steps * STEP_HEIGHT_PX;
    count++;
    if (accumulatedHeight >= windowHeight) break;
  }
  return Math.max(count, 1);
}

/**
 * 将 messageIds 按 maxSize 分批
 */
function chunkIds(ids: string[], maxSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += maxSize) {
    chunks.push(ids.slice(i, i + maxSize));
  }
  return chunks;
}

/**
 * useChat：管理对话生命周期与消息流的核心 Hook
 *
 * 特性：
 * - 维护 `conversationId`、响应状态、聊天列表
 * - 分层加载历史：先加载最新一页消息元数据占位，再根据 processingSteps 动态计算并批量加载事件
 * - 校验并替换提示词变量
 * - 通过 SSE 实时消费消息事件，增量更新助手内容
 */
export const useChat = ({
  httpClient,
  readEnabled = true,
  conversationId: defaultConversationId,
  promptVariablesConfig,
  streamTransport: configuredStreamTransport,
}: UseChatOptions): UseChatReturn => {
  const t = useAgentMessages("use-chat");
  const signal=useAiChatRequestSignal(httpClient);
  const { transport: preferredStreamTransport } =
    useChatStreamTransportPreference();
  const streamTransport = configuredStreamTransport ?? preferredStreamTransport;

  // 当前是否在初始化状态
  const isInitRef = useRef(false);
  const [isInit, setIsInit] = useState<boolean>(false);

  // 聊天列表与 SSE 流（由 useChatSseStream 管理）
  const {
    chatList,
    chatListRef,
    updateChatList,
    prependChatList,
    isResponding: isStreamResponding,
    isRespondingRef,
    isStreamConnectedRef,
    runStream,
    resubscribeStream,
    abortAllStreams,
    flushPendingUpdates,
    resetSettledMessageMetadata,
    streamHealth,
    isOnline,
    runStreamProbe,
  } = useChatMessages({
    httpClient,
    streamTransport,
  });
  const streamStatus = resolveChatStreamStatus({
    recoveryState: findLatestChatStreamRecoveryState(chatList),
    health: streamHealth,
    isOnline,
  });

  // 对话id
  const conversationIdRef = useRef<string | undefined>(defaultConversationId);
  const [conversationId, setConversationId] = useState<string | undefined>(
    defaultConversationId,
  );
  const [asyncTaskSyncAnchor, setAsyncTaskSyncAnchor] =
    useState<AsyncTaskSyncAnchor | null>(null);

  // 历史数据加载 hooks
  const getConversationMessages = useConversationMessages({ httpClient });
  const getChatEventsBatch = useChatEventsBatch({ httpClient });

  // 消息加载所有权与会话代次，防止旧请求或历史结果覆盖实时流。
  const messageLoadCoordinatorRef = useRef(new MessageLoadCoordinator());
  const conversationGenerationRef = useRef(0);
  const activeMessageIdRef = useRef<string | null>(null);

  // 分页状态
  const messagePageInfoRef = useRef({ current: 0, total: 0, hasMore: false });
  const [hasOlderMessages, setHasOlderMessages] = useState(false);

  // 加载更早消息状态
  const loadingOlderRef = useRef(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  /** 后端仍处于 PENDING 的消息即使本地 SSE 暂时断开，也必须保持可中断。 */
  const hasPendingMessage = useCallback(
    () =>
      chatListRef.current.some(
        (item) => item.status === ConversationMessageStatus.PENDING,
      ),
    [chatListRef],
  );
  const isResponding =
    isStreamResponding ||
    chatList.some((item) => item.status === ConversationMessageStatus.PENDING);
  const hasQueuedMessages = chatList.some(
    (item) =>
      item.status === ConversationMessageStatus.QUEUED &&
      resolveConversationExecutionType(item.user, item.executionType) !==
        "ASYNC_TASK_NOTIFICATION",
  );

  type HistoryMessageMetadata = Pick<
    ConversationMessageOutput,
    "messageId" | "status"
  > & {userMessage: ChatItem["user"]} &
    MessageStatistics;

  type HistoryMessagePatch = MessageStatistics & {
    messageId: string;
    user: ChatItem["user"];
    assistant: ChatItem["assistant"];
    status: string;
  };

  const batchLoadEventsRef = useRef<
    | ((
        cid: string,
        messages: HistoryMessageMetadata[],
        generation: number,
      ) => Promise<void>)
    | null
  >(null);

  /** 仅按 messageId 合并历史补丁，不替换请求发起时捕获的整张列表。 */
  const applyHistoryPatches = useCallback(
    (patches: HistoryMessagePatch[], generation: number) => {
      if (
        generation !== conversationGenerationRef.current ||
        patches.length === 0
      )
        return;

      const coordinator = messageLoadCoordinatorRef.current;
      const patchById = new Map(
        patches.map((patch) => [patch.messageId, patch]),
      );
      let changed = false;
      const nextList = chatListRef.current.map((item) => {
        const patch = patchById.get(item.id);
        if (!patch || coordinator.isStreaming(item.id)) return item;
        changed = true;
        coordinator.markHistoryLoaded(item.id);
        return {
          ...item,
          ...pickMessageStatistics(patch),
          loading: false,
          loaded: true,
          user: patch.user,
          assistant: patch.assistant,
          status: patch.status,
        };
      });
      if (changed) updateChatList(nextList);
    },
    [chatListRef, updateChatList],
  );

  /** 将消息交给 SSE；同一 messageId 已有 owner 时不会重复订阅。 */
  const startMessageStream = useCallback(
    (cid: string, messageId: string, generation: number) => {
      if (generation !== conversationGenerationRef.current) return;

      const coordinator = messageLoadCoordinatorRef.current;
      if (!coordinator.startStreaming(messageId)) return;
      activeMessageIdRef.current = messageId;

      const started = resubscribeStream({
        conversationId: cid,
        messageId,
        onConversationComplete: () => {
          if (generation === conversationGenerationRef.current) {
            coordinator.finishStreaming(messageId);
            if (activeMessageIdRef.current === messageId)
              activeMessageIdRef.current = null;
          }
        },
      });
      if (!started) coordinator.finishStreaming(messageId);
    },
    [resubscribeStream],
  );

  // 本地提交的排队消息需要保留回调和流参数，直到后端真正把它提升为 PENDING。
  const queuedTasksRef = useRef(new Map<string, QueuedMessageTask>());
  const promotingMessageIdsRef = useRef(new Set<string>());
  const startedMessageIdsRef = useRef(new Set<string>());

  /** 保证业务开始回调在当前会话生命周期内对同一消息至多执行一次。 */
  const notifyConversationStartOnce = useCallback(
    async (
      cid: string,
      messageId: string,
      callback?: SendCallback["onConversationStart"],
    ) => {
      if (startedMessageIdsRef.current.has(messageId)) return;
      startedMessageIdsRef.current.add(messageId);
      await callback?.(cid, messageId);
    },
    [],
  );

  /** 将服务端单消息状态合并到当前列表，不覆盖已经消费的助手事件。 */
  const applyMessageStatus = useCallback(
    (message: ConversationMessageOutput) => {
      const action = resolveMessageDispatchAction(message.status);
      const nextList = chatListRef.current.map((item) =>
        item.id === message.messageId
          ? {
              ...item,
              ...pickMessageStatistics(message),
              user: message.userMessage,
              executionType: message.executionType,
              parentMessageId: message.parentMessageId,
              status: message.status,
              loading: action === "STREAM",
              loaded:
                action === "POLL" || action === "SETTLE" ? true : item.loaded,
              startedAt:
                action === "STREAM"
                  ? (item.startedAt ?? Date.now())
                  : item.startedAt,
            }
          : item,
      );
      updateChatList(nextList);
    },
    [chatListRef, updateChatList],
  );

  /** 排队消息变为 PENDING 后建立 SSE，并保持开始/完成回调严格配对。 */
  const promoteQueuedMessage = useCallback(
    async (message: ConversationMessageOutput) => {
      if (promotingMessageIdsRef.current.has(message.messageId)) return;
      promotingMessageIdsRef.current.add(message.messageId);
      activeMessageIdRef.current = message.messageId;
      applyMessageStatus(message);

      const task = queuedTasksRef.current.get(message.messageId);
      try {
        await notifyConversationStartOnce(
          task?.conversationId ?? conversationIdRef.current ?? "",
          message.messageId,
          task?.callbacks.onConversationStart,
        );
      } catch (error) {
        console.error("排队消息开始回调失败", error);
      }

      const coordinator = messageLoadCoordinatorRef.current;
      if (!coordinator.startStreaming(message.messageId)) {
        promotingMessageIdsRef.current.delete(message.messageId);
        return;
      }
      const started = resubscribeStream({
        conversationId: task?.conversationId ?? conversationIdRef.current ?? "",
        messageId: message.messageId,
        rebuildOnFirstOpen: false,
        onConsumeEvent: task?.callbacks.onConsumeEvent,
        onConversationComplete: async (...args) => {
          coordinator.finishStreaming(message.messageId);
          queuedTasksRef.current.delete(message.messageId);
          promotingMessageIdsRef.current.delete(message.messageId);
          if (activeMessageIdRef.current === message.messageId)
            activeMessageIdRef.current = null;
          await task?.callbacks.onConversationComplete?.(...args);
        },
      });
      if (!started) {
        coordinator.finishStreaming(message.messageId);
        promotingMessageIdsRef.current.delete(message.messageId);
      }
    },
    [applyMessageStatus, notifyConversationStartOnce, resubscribeStream],
  );

  /** 每次只查询当前列表中最早的一条排队消息。 */
  const pollQueuedMessage =
    useCallback(async (): Promise<ConversationMessageOutput | null> => {
      const cid = conversationIdRef.current;
      const head = chatListRef.current.find(
        (item) => item.status === ConversationMessageStatus.QUEUED,
      );
      if (!cid || !head) return null;
      return httpClient.messages.getConversationMessage(cid, head.id, {signal});
    }, [chatListRef, httpClient]);

  const queuedMessageRequest = useApiRequest(pollQueuedMessage, {
    manual: true,
    pollingInterval: QUEUED_MESSAGE_POLLING_INTERVAL,
    pollingWhenHidden: false,
    pollingSilentLoading: true,
    disableErrorNotification: true,
    onSuccess: (message) => {
      if (!message) return;
      const action = resolveMessageDispatchAction(message.status);
      if (action === "POLL") return;
      if (action === "STREAM") {
        void promoteQueuedMessage(message);
        return;
      }

      applyMessageStatus(message);
      queuedTasksRef.current.delete(message.messageId);
      if (activeMessageIdRef.current === message.messageId)
        activeMessageIdRef.current = null;
      if (action === "LOAD_EVENTS" && conversationIdRef.current) {
        void batchLoadEventsRef.current?.(
          conversationIdRef.current,
          [message],
          conversationGenerationRef.current,
        );
      }
    },
  });
  const queuedHeadId = chatList.find(
    (item) => item.status === ConversationMessageStatus.QUEUED,
  )?.id;
  const { run: runQueuedMessagePolling, cancel: cancelQueuedMessagePolling } =
    queuedMessageRequest;

  useEffect(() => {
    if (readEnabled && queuedHeadId) runQueuedMessagePolling();
    else cancelQueuedMessagePolling();
  }, [
    cancelQueuedMessagePolling,
    queuedHeadId,
    runQueuedMessagePolling,
    readEnabled,
  ]);

  /**
   * 批量尝试加载完整历史；服务端返回 skipped 或旧后端漏回的 ID 会立即转交 SSE。
   */
  const batchLoadEvents = useCallback(
    async (
      cid: string,
      messages: HistoryMessageMetadata[],
      generation: number,
    ) => {
      const coordinator = messageLoadCoordinatorRef.current;
      const candidates = messages.filter((message) =>
        coordinator.tryStartHistory(message.messageId),
      );
      if (candidates.length === 0) return;

      const messageById = new Map(
        candidates.map((message) => [message.messageId, message]),
      );
      const patches: HistoryMessagePatch[] = [];
      const skippedIds = new Set<string>();

      try {
        const chunks = chunkIds(
          candidates.map((message) => message.messageId),
          BATCH_MAX_SIZE,
        );
        for (const chunk of chunks) {
          const { records, skipped } = await getChatEventsBatch(cid, chunk);
          if (generation !== conversationGenerationRef.current) return;

          const returnedIds = new Set<string>();
          for (const item of records) {
            returnedIds.add(item.messageId);
            const message = messageById.get(item.messageId);
            if (!message) continue;
            patches.push({
              ...pickMessageStatistics(message),
              messageId: item.messageId,
              user: message.userMessage,
              assistant: item.events,
              status: message.status,
            });
          }
          for (const item of skipped) {
            returnedIds.add(item.messageId);
            skippedIds.add(item.messageId);
          }
          // 兼容旧后端：未返回 records 的活动消息按 HISTORY_NOT_READY 处理。
          for (const messageId of chunk) {
            if (!returnedIds.has(messageId)) skippedIds.add(messageId);
          }
        }

        applyHistoryPatches(patches, generation);
        for (const messageId of skippedIds) {
          startMessageStream(cid, messageId, generation);
        }
      } finally {
        for (const message of candidates) {
          coordinator.finishHistory(message.messageId);
        }
      }
    },
    [applyHistoryPatches, getChatEventsBatch, startMessageStream],
  );
  batchLoadEventsRef.current = batchLoadEvents;

  // 初始化：加载历史对话记录
  useEffect(() => {
    let aborted = false;
    const cid = defaultConversationId ?? conversationIdRef.current;
    const generation = conversationGenerationRef.current + 1;
    resetSettledMessageMetadata();
    conversationGenerationRef.current = generation;
    messageLoadCoordinatorRef.current.reset();
    activeMessageIdRef.current = null;
    setAsyncTaskSyncAnchor(null);
    queuedTasksRef.current.clear();
    promotingMessageIdsRef.current.clear();
    startedMessageIdsRef.current.clear();

    if (!readEnabled) {
      abortAllStreams();
      setIsInit(false);
      return;
    }

    // 先加载最新一页消息元数据，具体消息事件仍按视口需要分批加载。
    if (cid) {
      const initHistory = async (): Promise<void> => {
        isInitRef.current = true;
        setIsInit(true);
        try {
          // 1. 只加载最新一页元数据；更早内容由消息列表接近顶部时继续分页。
          const { records: messages, page } = await getConversationMessages(
            cid,
            {
              current: 0,
              size: MESSAGE_PAGE_SIZE,
            },
          );
          if (aborted) return;
          setAsyncTaskSyncAnchor({
            conversationId: cid,
            messageId: messages[messages.length - 1]?.messageId ?? null,
          });

          // 2. 构建占位 ChatItem 列表；未知/活动状态保守交给实时流。
          const placeholderItems: ChatItem[] = messages.map((msg) => {
            const action = resolveMessageDispatchAction(msg.status);
            return {
              id: msg.messageId,
              ...pickMessageStatistics(msg),
              loading: action === "STREAM",
              loaded: action === "POLL" || action === "SETTLE",
              startedAt:
                action === "STREAM"
                  ? new Date(msg.createdTime).getTime()
                  : undefined,
              user: msg.userMessage,
              executionType: msg.executionType,
              parentMessageId: msg.parentMessageId,
              assistant: [],
              status: msg.status,
            };
          });
          updateChatList(placeholderItems);
          activeMessageIdRef.current =
            messages.find(
              (message) => message.status === ConversationMessageStatus.PENDING,
            )?.messageId ?? null;

          // 3. 动态计算需要加载的消息数量
          const windowHeight = window.innerHeight;
          const loadCount = calcInitialLoadCount(messages, windowHeight);
          const recentMessages = messages.slice(-loadCount);

          // 4. 实时消息先建立 SSE，历史候选随后并行加载。
          const streamingMessages = recentMessages.filter(
            (message) =>
              resolveMessageDispatchAction(message.status) === "STREAM",
          );
          const historyMessages = recentMessages.filter(
            (message) =>
              resolveMessageDispatchAction(message.status) === "LOAD_EVENTS",
          );
          for (const message of streamingMessages) {
            startMessageStream(cid, message.messageId, generation);
          }
          if (historyMessages.length > 0) {
            await batchLoadEvents(cid, historyMessages, generation);
            if (aborted || generation !== conversationGenerationRef.current)
              return;
          }

          // 5. 根据分页总数判断是否还需继续向上请求历史。
          const total = page?.total ?? messages.length;
          messagePageInfoRef.current = {
            current: 0,
            total,
            hasMore: total > messages.length,
          };
          setHasOlderMessages(total > messages.length);
        } catch (e) {
          if (aborted) return;
          console.error(`初始化对话id ${cid} 历史对话记录发生例外！`, e);
          toast.error(t.initConversationError);
        } finally {
          if (!aborted) {
            isInitRef.current = false;
            setIsInit(false);
          }
        }
      };
      initHistory().catch(console.error);
    }

    return () => {
      aborted = true;
      if (conversationGenerationRef.current === generation) {
        conversationGenerationRef.current += 1;
        messageLoadCoordinatorRef.current.reset();
      }
    };
  }, [readEnabled]);

  /** 合并新增公开轮次，保留现有流与历史加载所有权。 */
  const synchronizeMessages = useCallback(
    async (messages: ConversationMessageOutput[]): Promise<void | false> => {
      const cid = conversationIdRef.current;
      const generation = conversationGenerationRef.current;
      if (!cid || isInitRef.current) return false;
      if (messages.length === 0) return;
      if (
        cid !== conversationIdRef.current ||
        generation !== conversationGenerationRef.current
      )
        return false;
      const existing = new Set(chatListRef.current.map((item) => item.id));
      const additions: ChatItem[] = [];
      for (const message of messages) {
        if (existing.has(message.messageId)) continue;
        existing.add(message.messageId);
        additions.push({
          ...pickMessageStatistics(message),
          id: message.messageId,
          user: message.userMessage,
          assistant: [],
          executionType: message.executionType,
          parentMessageId: message.parentMessageId,
          status: message.status,
          loading: false,
          loaded: message.status === ConversationMessageStatus.QUEUED,
          startedAt: new Date(message.createdTime).getTime(),
        });
      }
      if (additions.length) {
        updateChatList([...chatListRef.current, ...additions]);
      }
      for (const message of messages) {
        applyMessageStatus(message);
        if (message.status === ConversationMessageStatus.PENDING)
          startMessageStream(cid, message.messageId, generation);
      }
      await batchLoadEvents(
        cid,
        messages.filter((message) =>
          hasReplayableMessageEvents(message.status),
        ),
        generation,
      );
    },
    [
      chatListRef,
      updateChatList,
      applyMessageStatus,
      startMessageStream,
      batchLoadEvents,
    ],
  );

  /** 异步通知仍维持原有来源校验，目标同步使用公开消息合并器。 */
  const synchronizeAsyncReplies = useCallback(
    (messages: ConversationMessageOutput[]) => {
      if (
        messages.some(
          (message) =>
            resolveConversationExecutionType(
              message.userMessage,
              message.executionType,
            ) !== "ASYNC_TASK_NOTIFICATION",
        )
      ) {
        throw new Error("异步任务增量同步接口返回了非异步通知消息");
      }
      return synchronizeMessages(messages);
    },
    [synchronizeMessages],
  );

  /** 只有当前没有会话或目标会话一致时才接管，避免覆盖已存在的流。 */
  const adoptConversation = useCallback((id: string) => {
    if (conversationIdRef.current && conversationIdRef.current !== id)
      throw new Error("当前会话已经改变");
    if (conversationIdRef.current === id) return;
    conversationIdRef.current = id;
    setConversationId(id);
    setAsyncTaskSyncAnchor({ conversationId: id, messageId: null });
  }, []);

  const asyncTaskSyncReady =
    readEnabled &&
    !isInit &&
    asyncTaskSyncAnchor?.conversationId === conversationId;
  const executionActive = chatList.some(
    (item) => item.status === ConversationMessageStatus.PENDING,
  );
  const { tasks: asyncTasks } = useAgentAsyncTasks({
    httpClient,
    conversationId,
    onSynchronize: synchronizeAsyncReplies,
    initialCursorMessageId: asyncTaskSyncAnchor?.messageId,
    ready: asyncTaskSyncReady,
    executionActive,
  });

  // 提示词变量检查
  const checkPromptVariables = useCheckPromptVariables();

  // 仅用于 handleStop 中追加本地手动中断事件并更新列表
  const consumeEvent = useConsumeEvent();

  /**
   * 对外 setChatList：初始化中禁止更新，其余委托给 useChatSseStream 的 updateChatList
   */
  const handleUpdateChatList = useCallback(
    (newChatList: ChatItem[]) => {
      if (isInitRef.current) {
        throw new Error(`当前对话正在初始化历史记录，请稍后！`);
      }
      updateChatList(newChatList);
    },
    [updateChatList],
  );

  /**
   * 将提示词模板中的变量替换为输入值
   */
  const getIntroduction = useCallback(
    (str: string) => {
      return replaceStringWithValues(
        str,
        promptVariablesConfig?.promptVariables || [],
        promptVariablesConfig?.inputs || {},
      );
    },
    [promptVariablesConfig?.inputs, promptVariablesConfig?.promptVariables],
  );

  /**
   * 停止当前对话
   */
  const handleStop = useCallback(
    async (force?: boolean | undefined) => {
      if (isInitRef.current) {
        throw new Error(`当前对话正在初始化历史记录，请稍后！`);
      }

      if (!isRespondingRef.current && !hasPendingMessage()) return;

      let interruptedRemotely = false;
      if (conversationIdRef.current) {
        try {
          await httpClient.chat.interruptConversation(conversationIdRef.current, {signal});
          interruptedRemotely = true;
        } catch {
          // 保持静默：弱网下保留 PENDING 状态和停止按钮，允许用户再次尝试。
        }
      }

      // 恢复订阅已经断开时，后端中断成功后需在本地结束 PENDING 状态。
      if (
        !conversationIdRef.current ||
        force === true ||
        (interruptedRemotely && !isStreamConnectedRef.current)
      ) {
        const currentChatList = flushPendingUpdates();
        abortAllStreams();

        const activeMessageId = activeMessageIdRef.current;
        const interruptTargetIndex = activeMessageId
          ? currentChatList.findIndex(
              (item) =>
                item.id === activeMessageId &&
                item.status === ConversationMessageStatus.PENDING,
            )
          : -1;

        const interruptTarget = currentChatList[interruptTargetIndex];
        if (interruptTarget) {
          const interruptedItem = {
            ...consumeEvent(interruptTarget, {
              type: AiChatEventTypeEnum.ManualInterrupt,
            }),
            loading: false,
            status: ConversationMessageStatus.INTERRUPTED,
          };
          const nextList = produce(currentChatList, (draft) => {
            draft[interruptTargetIndex] = interruptedItem;
          });
          updateChatList(nextList);
        }
      }
    },
    [
      abortAllStreams,
      consumeEvent,
      flushPendingUpdates,
      hasPendingMessage,
      httpClient,
      updateChatList,
      isRespondingRef,
      isStreamConnectedRef,
    ],
  );

  /** 取消一条服务端仍处于 QUEUED 的消息。 */
  const cancelQueuedMessage = useCallback(
    async (messageId: string) => {
      const cid = conversationIdRef.current;
      if (!cid) return;
      try {
        const message = await httpClient.messages.cancelQueuedMessage(cid, messageId, {signal});
        queuedTasksRef.current.delete(messageId);
        promotingMessageIdsRef.current.delete(messageId);
        applyMessageStatus(message);
      } catch (error) {
        // 取消和后端认领并发时，先刷新权威状态再向调用方保留原错误。
        await queuedMessageRequest.runAsync().catch(() => undefined);
        throw error;
      }
    },
    [applyMessageStatus, httpClient, queuedMessageRequest],
  );

  /**
   * 重新开始对话
   */
  const handleRestart = useCallback(async () => {
    if (isInitRef.current) {
      throw new Error(`当前对话正在初始化历史记录，请稍后！`);
    }

    conversationGenerationRef.current += 1;
    messageLoadCoordinatorRef.current.reset();
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    setAsyncTaskSyncAnchor(null);
    await handleStop(true);
    updateChatList([]);

    messagePageInfoRef.current = { current: 0, total: 0, hasMore: false };
    setHasOlderMessages(false);
  }, [handleStop, updateChatList]);

  /**
   * 发送消息并建立对话流
   */
  const handleSend = useCallback(
    async (
      data?: UserChatQuery,
      {
        onConversationSubmitted,
        onConversationStart,
        onConversationComplete,
        onConsumeEvent,
      }: SendCallback = {},
      options: SendOptions = {},
    ) => {
      if (isInitRef.current) {
        throw new Error(`当前对话正在初始化历史记录，请稍后！`);
      }

      if (
        promptVariablesConfig?.inputs &&
        promptVariablesConfig?.promptVariables
      ) {
        checkPromptVariables(promptVariablesConfig);
      }

      const query = !!data?.query ? getIntroduction(data.query) : undefined;

      const existingCid = options.conversationId ?? conversationIdRef.current;
      const {conversationId: _requestedConversationId, ...fields} = data ?? {};
      const input = {...fields, query: query ?? ""};
      const submission = existingCid
        ? await httpClient.chat.continueChat(existingCid, input, {signal})
        : await httpClient.chat.createChat(input, {signal});
      const { conversationId, messageId } = submission;
      try {
        await onConversationSubmitted?.(conversationId, messageId);
      } catch (error) {
        console.error("消息提交后的摘要同步失败", error);
      }
      const messageStatus = submission.status;
      conversationIdRef.current = conversationId;
      setConversationId(conversationId);
      setAsyncTaskSyncAnchor((current) =>
        current?.conversationId === conversationId
          ? current
          : { conversationId, messageId },
      );

      const coordinator = messageLoadCoordinatorRef.current;
      if (messageStatus === ConversationMessageStatus.PENDING) {
        activeMessageIdRef.current = messageId;
        coordinator.startStreaming(messageId);
        void runStream({
          conversationId,
          messageId,
          query,
          onConversationStart: (cid, mid) =>
            notifyConversationStartOnce(cid, mid, onConversationStart),
          onConversationComplete: async (...args) => {
            if (activeMessageIdRef.current === messageId)
              activeMessageIdRef.current = null;
            await onConversationComplete?.(...args);
          },
          onConsumeEvent,
        })
          .catch((error) => {
            console.error("消息流执行失败", error);
          })
          .finally(() => {
            coordinator.finishStreaming(messageId);
          });
      } else {
        const action = resolveMessageDispatchAction(messageStatus);
        updateChatList([
          ...chatListRef.current,
          {
            id: messageId,
            loading: false,
            loaded: action !== "LOAD_EVENTS",
            user: query ? { text: query } : undefined,
            assistant: [],
            status: messageStatus,
          },
        ]);
        if (action === "POLL") {
          queuedTasksRef.current.set(messageId, {
            conversationId,
            callbacks: {
              onConversationStart,
              onConversationComplete,
              onConsumeEvent,
            },
          });
        } else if (action === "LOAD_EVENTS") {
          const generation = conversationGenerationRef.current;
          void httpClient.messages.getConversationMessage(conversationId, messageId, {signal})
            .then((message) =>
              batchLoadEvents(conversationId, [message], generation),
            )
            .catch((error) => {
              console.error("加载已结束消息事件失败", error);
            });
        }
      }
      return submission;
    },
    [
      checkPromptVariables,
      promptVariablesConfig,
      getIntroduction,
      httpClient,
      runStream,
      batchLoadEvents,
      chatListRef,
      notifyConversationStartOnce,
      updateChatList,
    ],
  );

  /**
   * 加载更早的历史消息（向上分页）
   */
  const loadOlderMessages = useCallback(async () => {
    if (!readEnabled || !conversationIdRef.current || loadingOlderRef.current)
      return;
    if (!messagePageInfoRef.current.hasMore) return;

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      const nextPage = messagePageInfoRef.current.current + 1;
      const { records: messages, page } = await getConversationMessages(
        conversationIdRef.current,
        { current: nextPage, size: MESSAGE_PAGE_SIZE },
      );

      const generation = conversationGenerationRef.current;
      const cid = conversationIdRef.current;

      // 构建占位项并前置到列表；服务端分页为 DESC，hook 已恢复为页内 ASC。
      const placeholderItems: ChatItem[] = messages.map((msg) => {
        const action = resolveMessageDispatchAction(msg.status);
        return {
          id: msg.messageId,
          ...pickMessageStatistics(msg),
          loading: action === "STREAM",
          loaded: action === "POLL" || action === "SETTLE",
          startedAt:
            action === "STREAM"
              ? new Date(msg.createdTime).getTime()
              : undefined,
          user: msg.userMessage,
          executionType: msg.executionType,
          parentMessageId: msg.parentMessageId,
          assistant: [],
          status: msg.status,
        };
      });
      prependChatList(placeholderItems);

      // 动态计算需要加载的消息数量并先建立实时流，再请求完整历史。
      const windowHeight = window.innerHeight;
      const loadCount = calcInitialLoadCount(messages, windowHeight);
      const recentOfNew = messages.slice(-loadCount);
      const streamingMessages = recentOfNew.filter(
        (message) => resolveMessageDispatchAction(message.status) === "STREAM",
      );
      const historyMessages = recentOfNew.filter(
        (message) =>
          resolveMessageDispatchAction(message.status) === "LOAD_EVENTS",
      );

      for (const message of streamingMessages) {
        startMessageStream(cid, message.messageId, generation);
      }
      if (historyMessages.length > 0) {
        await batchLoadEvents(cid, historyMessages, generation);
      }
      if (generation !== conversationGenerationRef.current) return;

      const total = page?.total ?? messages.length;
      messagePageInfoRef.current = {
        current: nextPage,
        total,
        hasMore: total > (nextPage + 1) * MESSAGE_PAGE_SIZE,
      };
      setHasOlderMessages(total > (nextPage + 1) * MESSAGE_PAGE_SIZE);
    } catch (e) {
      console.error("加载更早消息失败:", e);
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [
    batchLoadEvents,
    getConversationMessages,
    prependChatList,
    startMessageStream,
    readEnabled,
  ]);

  /**
   * 按需加载单条消息的事件内容（用于导航器点击）
   */
  const loadMessageEvents = useCallback(
    async (messageId: string) => {
      const existing = chatListRef.current.find(
        (item) => item.id === messageId,
      );
      if (!existing || existing.loaded || !conversationIdRef.current) return;

      const generation = conversationGenerationRef.current;
      if (
        !existing.status ||
        resolveMessageDispatchAction(existing.status) === "STREAM"
      ) {
        startMessageStream(conversationIdRef.current, messageId, generation);
        return;
      }
      if (!hasReplayableMessageEvents(existing.status)) return;

      try {
        await batchLoadEvents(
          conversationIdRef.current,
          [
            {
              ...pickMessageStatistics(existing),
              messageId,
              userMessage: {
                ...existing.user,
                text: existing.user?.text ?? "",
                executionType: resolveConversationExecutionType(
                  existing.user,
                  existing.executionType,
                ),
              },
              status: existing.status,
            },
          ],
          generation,
        );
      } catch (e) {
        console.error(`加载消息 ${messageId} 事件失败:`, e);
      }
    },
    [batchLoadEvents, chatListRef, startMessageStream],
  );

  return {
    adoptConversation,
    messageSyncAnchor: asyncTaskSyncAnchor,
    synchronizeMessages,
    isInit,
    chatList,
    asyncTasks,
    setChatList: handleUpdateChatList,
    conversationId,
    isResponding,
    hasQueuedMessages,
    handleSend,
    handleRestart,
    handleStop,
    cancelQueuedMessage,
    loadOlderMessages,
    loadMessageEvents,
    isLoadingOlder,
    hasOlderMessages,
    streamStatus,
    runStreamProbe,
  };
};
