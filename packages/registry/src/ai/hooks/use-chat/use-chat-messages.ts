"use client";
import {useAiChatRequestSignal} from '../../agents/context';
/**
 * 聊天消息管理 Hook
 *
 * 负责管理聊天列表状态、SSE 事件流消费和断线重订阅。
 *
 * @author 思追(shaco)
 */


import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {linkAbortSignals} from "../../../api/utils/abort";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {ApiError} from "@lingya-ai/agents-sdk/browser";


import type { ChatStreamHealthState } from "./chat-stream-health";
import type { ChatStreamTransport } from "./chat-stream-transport";


import {
  type ChatStreamRenderBatcher,
  createChatStreamRenderBatcher,
} from "./chat-stream-render-batcher";
import { ConversationMessageStatus } from "./conversation-message";
import {
  type AiChatEvent,
  AiChatEventTypeEnum,
} from "./schema";
import type {
  ChatItem,
  ChatStreamRecoveryState,
  SendCallback,
} from "./types";
import { useConsumeEvent } from "./use-consume-event";
import { useChatStreamHealth } from "./use-chat-stream-health";
import {useSettledMessageMetadata} from "./use-settled-message-metadata";

/** 断线重试间隔；达到上限后持续按 5 秒重试。 */
const STREAM_RETRY_DELAYS_MS = [1_000, 2_000, 3_000, 5_000] as const;
export type UseChatSseStreamOptions = {
  /** HTTP 客户端 */
  httpClient: AgentsClient;
  /** 当前逻辑流使用的传输协议。 */
  streamTransport?: ChatStreamTransport;
};

/**
 * 运行流参数
 */
export type RunStreamParams = {
  /** 对话 ID */
  conversationId: string;
  /** 消息 ID */
  messageId: string;
  /** 请求体（除 query 外），由 use-chat 传入 */
  /** 用户输入，用于占位消息的 user.text */
  query?: string;
  onConversationStart?: SendCallback["onConversationStart"];
  onConsumeEvent?: SendCallback["onConsumeEvent"];
  onConversationComplete?: SendCallback["onConversationComplete"];
};

/**
 * 重新订阅 PENDING 消息的参数
 */
export type ResubscribeStreamParams = {
  /** 对话 ID */
  conversationId: string;
  /** 消息 ID */
  messageId: string;
  /** 首次提交附带的流参数；历史恢复时可以省略。 */
  /** 首次连接是否进入历史重建态；排队消息首次建流时传 false，默认 true。 */
  rebuildOnFirstOpen?: boolean;
  /** 消费每次的数据事件 */
  onConsumeEvent?: SendCallback["onConsumeEvent"];
  /** 在对话完成时 */
  onConversationComplete?: SendCallback["onConversationComplete"];
};

/**
 * SSE 流返回值
 */
export type UseChatSseStreamReturn = {
  /** 聊天记录列表 */
  chatList: ChatItem[];
  /** 聊天列表最新快照，供异步历史响应按 ID 增量合并。 */
  chatListRef: RefObject<ChatItem[]>;
  /** 更新聊天列表（同时同步 ref），用于初始化历史、重启、以及 runStream 内部提交 */
  updateChatList: (nextList: ChatItem[]) => void;
  /** 在列表头部前置消息（加载更早历史时使用） */
  prependChatList: (items: ChatItem[]) => void;
  /** 按 messageId 替换单条消息（按需加载事件后使用） */
  updateChatItem: (messageId: string, item: ChatItem) => void;
  /** 是否存在仍在执行或等待重连的消息流 */
  isResponding: boolean;
  /** 是否存在仍在执行或等待重连的消息流（ref） */
  isRespondingRef: RefObject<boolean>;
  /** 当前是否至少有一条 SSE 已收到有效帧，供停止逻辑区分断线恢复状态。 */
  isStreamConnectedRef: RefObject<boolean>;
  /** 启动 SSE 流：创建占位、订阅事件、按条消费并提交到列表 */
  runStream: (params: RunStreamParams) => Promise<void>;
  /** 重新订阅消息的 SSE 流；同一 messageId 已有订阅时返回 false。 */
  resubscribeStream: (params: ResubscribeStreamParams) => boolean;
  /** 最近建立的中断控制器 ref，保留给现有单流调用方。 */
  abortControllerRef: RefObject<AbortController | null>;
  /** 作废当前作用域的统计补全请求，供历史初始化切换代次。 */
  resetSettledMessageMetadata: () => void;
  /** 中断当前 Hook 持有的全部本地 SSE 连接和重试任务，不会中断后端 Agent。 */
  abortAllStreams: () => void;
  /** 立即提交所有 SSE 流尚未渲染的 Message/Think 增量 */
  flushPendingUpdates: () => ChatItem[];
  /** 当前聊天 SSE 传输健康状态。 */
  streamHealth: ChatStreamHealthState;
  /** 浏览器报告的设备联网状态。 */
  isOnline: boolean;
  /** 主动通过同链路探测接口重新检测 SSE 传输。 */
  runStreamProbe: () => Promise<void>;
};

type ActiveStreamSession = {
  connected: boolean;
  cancel: () => void;
  flush: () => void;
  restartForTransportChange: () => void;
};

type StartStreamSessionOptions = {
  conversationId: string;
  messageId: string;
  placeholderId: string;
  initialChatItem: ChatItem;
  /** 页面恢复已有 PENDING 消息时，首次连接也需要从 Redis 流头重建。 */
  rebuildOnFirstOpen: boolean;
  onConsumeEvent?: SendCallback["onConsumeEvent"];
  onConversationComplete?: SendCallback["onConversationComplete"];
};

type StartStreamSessionResult = {
  started: boolean;
  completion: Promise<void>;
};

/**
 * 创建占位消息。
 */
function createPlaceholderMessage(query?: string): {
  placeholderId: string;
  chatItem: ChatItem;
} {
  const placeholderId = `m-${Date.now()}`;
  const chatItem: ChatItem = {
    id: placeholderId,
    loading: true,
    loaded: true,
    startedAt: Date.now(),
    user: query ? { text: query } : undefined,
    assistant: [],
    status: ConversationMessageStatus.PENDING,
    renderVersion: 0,
  };
  return { placeholderId, chatItem };
}

/**
 * 只有网络、超时、限流和服务端暂时错误才自动重订阅。
 * 解析、Schema、消息回调及明确的客户端错误应直接收口，避免无限重放坏数据。
 */
function isReconnectableStreamError(error: ApiError): boolean {
  if (['authentication', 'protocol', 'cancelled'].includes(error.kind)) return false;
  if (['network', 'timeout', 'unexpected_eof'].includes(error.kind)) return true;
  const statusCode = error.status;
  if (statusCode === undefined) return false;
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500)
    return true;
  return false;
}

/**
 * 聊天消息管理 Hook。
 *
 * 网络断开时保留当前内容，并以同一 conversationId + messageId 重订阅 Redis 事件流。
 * 新连接建立后清空当前助手渲染并从流头重建，避免在半截 UI 上继续追加造成重复。
 */
export function useChatMessages({
  httpClient,
  streamTransport = "sse",
}: UseChatSseStreamOptions): UseChatSseStreamReturn {
  const providerSignal = useAiChatRequestSignal(httpClient);
  const [chatList, setChatList] = useState<ChatItem[]>([]);
  const chatListRef = useRef<ChatItem[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const isRespondingRef = useRef(false);
  const isStreamConnectedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeSessionsRef = useRef<Map<string, ActiveStreamSession>>(new Map());
  const activeRenderBatchersRef = useRef<Set<ChatStreamRenderBatcher>>(
    new Set(),
  );
  const isMountedRef = useRef(true);
  const streamTransportRef = useRef(streamTransport);
  const previousStreamTransportRef = useRef(streamTransport);
  streamTransportRef.current = streamTransport;

  const consumeEvent = useConsumeEvent();
  const {
    streamHealth,
    isOnline,
    handleDiagnostic: handleStreamHealthDiagnostic,
    runStreamProbe,
  } = useChatStreamHealth(httpClient, streamTransport === "sse");

  /** 更新聊天列表状态与引用。 */
  const updateChatList = useCallback((nextList: ChatItem[]) => {
    chatListRef.current = nextList;
    if (isMountedRef.current) {
      setChatList(nextList);
    }
  }, []);

  const {notifyEnd: notifySettledEnd, beginMessage: beginMetadataMessage, reset: resetSettledMessageMetadata} =
    useSettledMessageMetadata({
      httpClient,
      getMessage: messageId => chatListRef.current.find(item => item.id === messageId),
      patchMessage: (messageId, patch) => {
        const index = chatListRef.current.findIndex(item => item.id === messageId);
        const item = chatListRef.current[index];
        if (!item) return;
        const next = [...chatListRef.current];
        next[index] = {...item, ...patch};
        updateChatList(next);
      },
    });

  /** 同步逻辑流响应状态；等待重连期间也保持 true。 */
  const updateIsResponding = useCallback((nextIsResponding: boolean) => {
    isRespondingRef.current = nextIsResponding;
    if (isMountedRef.current) {
      setIsResponding(nextIsResponding);
    }
  }, []);

  /** 同步当前是否至少存在一条已收到有效帧的 SSE。 */
  const syncConnectedState = useCallback(() => {
    isStreamConnectedRef.current = Array.from(
      activeSessionsRef.current.values(),
    ).some((session) => session.connected);
  }, []);

  /** 在列表头部前置消息（加载更早历史时使用）。 */
  const prependChatList = useCallback((items: ChatItem[]) => {
    const nextList = [...items, ...chatListRef.current];
    chatListRef.current = nextList;
    if (isMountedRef.current) {
      setChatList(nextList);
    }
  }, []);

  /** 按 messageId 替换单条消息（按需加载事件后使用）。 */
  const updateChatItem = useCallback(
    (messageId: string, item: ChatItem) => {
      const nextList = chatListRef.current.map((currentItem) =>
        currentItem.id === messageId ? item : currentItem,
      );
      updateChatList(nextList);
    },
    [updateChatList],
  );

  /** 提交/替换当前聊天项（占位或最终项）到列表。 */
  const commitChatItemUpdate = useCallback(
    (chatItem: ChatItem, placeholderMessageId: string) => {
      const index = chatListRef.current.findIndex(
        (item) => item.id === chatItem.id || item.id === placeholderMessageId,
      );
      const nextList =
        index >= 0
          ? chatListRef.current.map((item, currentIndex) =>
              currentIndex === index ? chatItem : item,
            )
          : [...chatListRef.current, chatItem];
      updateChatList(nextList);
    },
    [updateChatList],
  );

  /** 立即提交当前 Hook 下所有 SSE 流尚未渲染的文本增量。 */
  const flushPendingUpdates = useCallback(() => {
    for (const session of activeSessionsRef.current.values()) {
      session.flush();
    }
    return chatListRef.current;
  }, []);

  /**
   * 建立一条逻辑消息流。一次逻辑流可跨越多个 SSE 连接，直到收到终止事件、显式取消或不可恢复错误。
   */
  const startStreamSession = useCallback(
    (options: StartStreamSessionOptions): StartStreamSessionResult => {
      const {
        conversationId,
        messageId,
        placeholderId,
        initialChatItem,
        rebuildOnFirstOpen,
        onConsumeEvent,
        onConversationComplete,
      } = options;

      if (activeSessionsRef.current.has(messageId)) {
        return { started: false, completion: Promise.resolve() };
      }

      beginMetadataMessage(conversationId, messageId);
      let active = true;
      let attemptGeneration = 0;
      let retryIndex = 0;
      let currentController: AbortController | null = null;
      let currentRenderBatcher: ChatStreamRenderBatcher | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let removeOnlineListener: (() => void) | null = null;
      let removeOfflineListener: (() => void) | null = null;
      let highestConsumedEventCount = 0;
      let replayBoundary = 0;
      let attemptEventCount = 0;
      let replaying = rebuildOnFirstOpen;
      let streamInterrupted = false;
      let completionCalled = false;
      let resolveCompletion: () => void = () => undefined;
      let rejectCompletion: (reason?: unknown) => void = () => undefined;

      const completion = new Promise<void>((resolve, reject) => {
        resolveCompletion = resolve;
        rejectCompletion = reject;
      });

      const session: ActiveStreamSession = {
        connected: false,
        cancel: () => undefined,
        flush: () => currentRenderBatcher?.flush(),
        restartForTransportChange: () => undefined,
      };

      const findCurrentChatItem = (): ChatItem => {
        return (
          chatListRef.current.find(
            (item) => item.id === messageId || item.id === placeholderId,
          ) ?? initialChatItem
        );
      };

      const clearRetrySchedule = () => {
        if (retryTimer !== null) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        removeOnlineListener?.();
        removeOnlineListener = null;
      };

      const cleanupAttempt = (abort: boolean) => {
        removeOfflineListener?.();
        removeOfflineListener = null;
        currentRenderBatcher?.flush();
        if (currentRenderBatcher) {
          currentRenderBatcher.dispose();
          activeRenderBatchersRef.current.delete(currentRenderBatcher);
          currentRenderBatcher = null;
        }

        session.connected = false;
        syncConnectedState();

        const controller = currentController;
        currentController = null;
        if (abortControllersRef.current.get(messageId) === controller) {
          abortControllersRef.current.delete(messageId);
        }
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (abort && controller && !controller.signal.aborted) {
          controller.abort();
        }
      };

      const updateRecoveryState = (
        state: ChatStreamRecoveryState | undefined,
        resetRender = false,
      ): ChatItem => {
        const current = findCurrentChatItem();
        const nextItem: ChatItem = resetRender
          ? {
              ...current,
              id: messageId,
              assistant: [],
              loading: true,
              loaded: true,
              status: ConversationMessageStatus.PENDING,
              streamRecoveryState: state,
              renderVersion: (current.renderVersion ?? 0) + 1,
            }
          : {
              ...current,
              id: messageId,
              loading: state === undefined ? current.loading : true,
              loaded: true,
              streamRecoveryState: state,
            };
        commitChatItemUpdate(nextItem, placeholderId);
        return nextItem;
      };

      const removeSession = () => {
        clearRetrySchedule();
        activeSessionsRef.current.delete(messageId);
        updateIsResponding(activeSessionsRef.current.size > 0);
        syncConnectedState();
      };

      const callConversationComplete = async (
        hasError: boolean,
        errorMessage?: string,
      ) => {
        if (completionCalled) return;
        completionCalled = true;
        await onConversationComplete?.(
          hasError,
          conversationId,
          messageId,
          errorMessage,
          streamInterrupted,
        );
      };

      const finishSuccessfully = async (realEnd = false) => {
        if (!active) return;
        currentRenderBatcher?.updateAndFlush((current) => ({
          ...current,
          loading: false,
          loaded: true,
          streamRecoveryState: undefined,
        }));
        active = false;
        cleanupAttempt(true);
        removeSession();
        if (realEnd) notifySettledEnd(conversationId, messageId);
        try {
          await callConversationComplete(false);
          resolveCompletion();
        } catch (error) {
          rejectCompletion(error);
        }
      };

      const finishWithError = async (error: ApiError) => {
        if (!active) return;
        active = false;
        cleanupAttempt(false);
        const current = findCurrentChatItem();
        commitChatItemUpdate(
          {
            ...current,
            loading: false,
            loaded: true,
            streamRecoveryState: undefined,
          },
          placeholderId,
        );
        removeSession();
        toast.warning(error.message);
        try {
          await callConversationComplete(true, error.message);
        } finally {
          rejectCompletion(error);
        }
      };

      const cancelSession = () => {
        if (!active) return;
        active = false;
        cleanupAttempt(true);
        removeSession();
        resolveCompletion();
      };
      session.cancel = cancelSession;

      const startAttempt = () => { void startAuthenticatedAttempt(); };
      const startAuthenticatedAttempt = async () => {
        if (!active) return;
        clearRetrySchedule();

        attemptGeneration += 1;
        const generation = attemptGeneration;
        const attemptTransport = streamTransportRef.current;
        attemptEventCount = 0;
        let attemptSettled = false;
        let attemptOpened = false;

        const openAttempt = () => {
          if (!active || attemptOpened || generation !== attemptGeneration) {
            return;
          }
          attemptOpened = true;

          const attemptInitialItem = replaying
            ? updateRecoveryState("rebuilding", true)
            : {
                ...findCurrentChatItem(),
                id: messageId,
                loading: true,
                loaded: true,
                status: ConversationMessageStatus.PENDING,
              };

          if (!replaying) {
            commitChatItemUpdate(attemptInitialItem, placeholderId);
          }

          currentRenderBatcher = createChatStreamRenderBatcher({
            initialChatItem: attemptInitialItem,
            consumeEvent,
            commit: (nextChatItem) => {
              if (active && generation === attemptGeneration) {
                commitChatItemUpdate(nextChatItem, placeholderId);
              }
            },
          });
          activeRenderBatchersRef.current.add(currentRenderBatcher);
        };

        const reconnectAttempt = (abort: boolean) => {
          if (!active || attemptSettled || generation !== attemptGeneration) {
            return;
          }
          attemptSettled = true;
          currentRenderBatcher?.updateAndFlush((current) => ({
            ...current,
            loading: true,
            loaded: true,
            streamRecoveryState: "reconnecting",
          }));
          if (!currentRenderBatcher) updateRecoveryState("reconnecting");
          cleanupAttempt(abort);
          replayBoundary = highestConsumedEventCount;
          replaying = true;
          scheduleReconnect();
        };

        const handleAttemptError = async (error: ApiError) => {
          if (!active || attemptSettled || generation !== attemptGeneration) {
            return;
          }
          attemptSettled = true;

          if (!isReconnectableStreamError(error)) {
            await finishWithError(error);
            return;
          }

          currentRenderBatcher?.updateAndFlush((current) => ({
            ...current,
            loading: true,
            loaded: true,
            streamRecoveryState: "reconnecting",
          }));
          if (!currentRenderBatcher) updateRecoveryState("reconnecting");
          cleanupAttempt(false);
          replayBoundary = highestConsumedEventCount;
          replaying = true;
          scheduleReconnect();
        };

        const consumeStreamEvent = async (event: AiChatEvent) => {
          if (
            !active ||
            generation !== attemptGeneration ||
            !currentRenderBatcher
          ) {
            return;
          }

          attemptEventCount += 1;
          const shouldForwardExternalEffect =
            !replaying || attemptEventCount > replayBoundary;
          if (shouldForwardExternalEffect) {
            try {
              await onConsumeEvent?.(conversationId, messageId, event);
            } catch (error) {
              // 业务回调失败不是后端终态证据；但已经收到的真实 End 不能因此丢失。
              if (event.type === AiChatEventTypeEnum.End && active &&
                generation === attemptGeneration && currentRenderBatcher) {
                currentRenderBatcher.consume(event);
                currentRenderBatcher.updateAndFlush(current => ({...current, messageStatsPending: true}));
                notifySettledEnd(conversationId, messageId);
              }
              throw error;
            }
          }

          // 外部回调可能等待网络或切换会话，恢复后再次校验流所有权。
          if (!active || generation !== attemptGeneration || !currentRenderBatcher) return;
          currentRenderBatcher.consume(event);
          highestConsumedEventCount = Math.max(
            highestConsumedEventCount,
            attemptEventCount,
          );

          if (replaying && attemptEventCount >= replayBoundary) {
            replaying = false;
            retryIndex = 0;
            currentRenderBatcher.updateAndFlush((current) => ({
              ...current,
              streamRecoveryState: undefined,
            }));
          }

          if (event.type === AiChatEventTypeEnum.ManualInterrupt) {
            streamInterrupted = true;
          }
          if (event.type === AiChatEventTypeEnum.End) {
            attemptSettled = true;
            await finishSuccessfully(true);
          }
        };

        const registerController = (
          controller: AbortController,
          cancelOnUnexpectedAbort: boolean,
        ) => {
          if (!active || generation !== attemptGeneration) {
            controller.abort();
            return false;
          }

          currentController = controller;
          abortControllerRef.current = controller;
          abortControllersRef.current.set(messageId, controller);

          if (cancelOnUnexpectedAbort) {
            controller.signal.addEventListener(
              "abort",
              () => {
                queueMicrotask(() => {
                  if (
                    !active ||
                    attemptSettled ||
                    generation !== attemptGeneration
                  ) {
                    return;
                  }
                  cancelSession();
                });
              },
              { once: true },
            );
          }

          const handleOffline = () => reconnectAttempt(true);
          window.addEventListener("offline", handleOffline, { once: true });
          removeOfflineListener = () =>
            window.removeEventListener("offline", handleOffline);
          if (!navigator.onLine) handleOffline();
          return true;
        };

        const controller = new AbortController();
        if (!registerController(controller, false)) return;
        const unlinkProvider = linkAbortSignals(controller, [providerSignal]);
        const subscription = httpClient.chat.subscribeChatEvents(conversationId, {messageId}, {
          signal: controller.signal,
          transport: attemptTransport === "ws" ? "websocket" : "sse",
          idleTimeoutMs: 25_000,
          onConnectionEvent: event => {
            if (!active || generation !== attemptGeneration) return;
            handleStreamHealthDiagnostic(event, {conversationId, messageId, streamAttempt: generation, replaying});
            if (event.type === "ready" || (attemptTransport !== "ws" && event.type === "opened")) openAttempt();
            if (event.type === "ready" || event.type === "heartbeat") {
              session.connected = true; syncConnectedState();
            }
          },
        });
        try {
          for await (const event of subscription) {
            if (!active || generation !== attemptGeneration) break;
            if (!attemptOpened) openAttempt();
            session.connected = true; syncConnectedState();
            await consumeStreamEvent(event);
          }
          const close = await subscription.closed;
          if (active && !attemptSettled && generation === attemptGeneration) {
            if (close.reason === "complete" || close.reason === "normal") {
              attemptSettled = true;
              await finishSuccessfully();
            } else reconnectAttempt(false);
          }
        } catch (cause) {
          if (!active || generation !== attemptGeneration) return;
          await handleAttemptError(cause instanceof ApiError ? cause : new ApiError("", "", undefined, "", {kind: "protocol", cause}));
        } finally { subscription.close(); unlinkProvider(); }

      };

      const scheduleReconnect = () => {
        if (!active) return;
        clearRetrySchedule();

        const delay =
          STREAM_RETRY_DELAYS_MS[
            Math.min(retryIndex, STREAM_RETRY_DELAYS_MS.length - 1)
          ];
        retryIndex += 1;

        const connect = () => {
          if (!active) return;
          retryTimer = setTimeout(startAttempt, delay);
        };

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const handleOnline = () => {
            removeOnlineListener?.();
            removeOnlineListener = null;
            startAttempt();
          };
          window.addEventListener("online", handleOnline, { once: true });
          removeOnlineListener = () =>
            window.removeEventListener("online", handleOnline);
          return;
        }

        connect();
      };

      session.restartForTransportChange = () => {
        if (!active) return;
        clearRetrySchedule();
        retryIndex = 0;
        currentRenderBatcher?.updateAndFlush((current) => ({
          ...current,
          loading: true,
          loaded: true,
          streamRecoveryState: "reconnecting",
        }));
        if (!currentRenderBatcher) updateRecoveryState("reconnecting");
        cleanupAttempt(true);
        replayBoundary = highestConsumedEventCount;
        replaying = true;
        startAttempt();
      };

      activeSessionsRef.current.set(messageId, session);
      updateIsResponding(true);

      if (rebuildOnFirstOpen) {
        updateRecoveryState("reconnecting");
        replayBoundary = 0;
      }
      startAttempt();

      return { started: true, completion };
    },
    [
      beginMetadataMessage,
      notifySettledEnd,
      commitChatItemUpdate,
      consumeEvent,
      handleStreamHealthDiagnostic,
      httpClient,
      syncConnectedState,
      updateIsResponding,
    ],
  );

  useEffect(() => {
    if (previousStreamTransportRef.current === streamTransport) return;
    previousStreamTransportRef.current = streamTransport;
    for (const session of activeSessionsRef.current.values()) {
      session.restartForTransportChange();
    }
  }, [streamTransport]);

  /** 中断全部本地流连接和等待中的重试；后端执行仅由显式 interrupt API 控制。 */
  const abortAllStreams = useCallback(() => {
    resetSettledMessageMetadata();
    for (const session of Array.from(activeSessionsRef.current.values())) {
      session.cancel();
    }
    updateIsResponding(false);
    isStreamConnectedRef.current = false;
  }, [resetSettledMessageMetadata, updateIsResponding]);

  /** 组件卸载时清理连接和重试任务。 */
  useEffect(() => {
    isMountedRef.current = true;
    const activeRenderBatchers = activeRenderBatchersRef.current;
    const abortControllers = abortControllersRef.current;

    return () => {
      isMountedRef.current = false;
      abortAllStreams();
      activeRenderBatchers.clear();
      abortControllers.clear();
    };
  }, [abortAllStreams]);

  /** 启动消息流：创建占位、订阅事件、按条消费并提交到列表。 */
  const runStream = useCallback(
    async (params: RunStreamParams): Promise<void> => {
      const {
        conversationId,
        messageId,
        query,
        onConversationStart,
        onConsumeEvent,
        onConversationComplete,
      } = params;

      const { placeholderId, chatItem } = createPlaceholderMessage(query);
      const initialChatItem: ChatItem = { ...chatItem, id: messageId };
      updateChatList([...chatListRef.current, initialChatItem]);
      updateIsResponding(true);

      try {
        await onConversationStart?.(conversationId, messageId);
      } catch (error) {
        commitChatItemUpdate(
          { ...initialChatItem, loading: false },
          placeholderId,
        );
        updateIsResponding(activeSessionsRef.current.size > 0);
        throw error;
      }

      const { completion } = startStreamSession({
        conversationId,
        messageId,
        placeholderId,
        initialChatItem,
        rebuildOnFirstOpen: false,
        onConsumeEvent,
        onConversationComplete,
      });
      return completion;
    },
    [
      commitChatItemUpdate,
      startStreamSession,
      updateChatList,
      updateIsResponding,
    ],
  );

  /**
   * 重新订阅 PENDING 状态消息的事件流。
   * 页面刷新或历史加载发现活动消息时，首次建立连接也从 Redis 流头重建当前助手渲染。
   */
  const resubscribeStream = useCallback(
    (params: ResubscribeStreamParams): boolean => {
      const {
        conversationId,
        messageId,
        rebuildOnFirstOpen = true,
        onConsumeEvent,
        onConversationComplete,
      } = params;

      if (activeSessionsRef.current.has(messageId)) return false;
      const initialChatItem = chatListRef.current.find(
        (item) => item.id === messageId,
      );
      if (!initialChatItem) return false;

      const result = startStreamSession({
        conversationId,
        messageId,
        placeholderId: messageId,
        initialChatItem: {
          ...initialChatItem,
          loading: true,
          loaded: true,
        },
        rebuildOnFirstOpen,
        onConsumeEvent,
        onConversationComplete,
      });
      void result.completion.catch(() => {
        // 错误已经由消息状态、toast 和 onConversationComplete 收口。
      });
      return result.started;
    },
    [startStreamSession],
  );

  return {
    chatList,
    chatListRef,
    updateChatList,
    prependChatList,
    updateChatItem,
    isResponding,
    isRespondingRef,
    isStreamConnectedRef,
    runStream,
    resubscribeStream,
    abortControllerRef,
    abortAllStreams,
    resetSettledMessageMetadata,
    flushPendingUpdates,
    streamHealth,
    isOnline,
    runStreamProbe,
  };
}
