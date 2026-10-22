"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDocumentVisibility,
  useEventListener,
  useLatest,
  useMemoizedFn,
} from "ahooks";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useAiChatRequestSignal} from "../../agents/context";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import {
  conversationActivityReducer,
  createConversationActivityState,
  markConversationRead,
  normalizeConversationIds,
  requestActiveConversations,
  requestConversationActivities,
  requestUnreadConversations,
  selectConversationActivities,
  selectConversationActivityPollingIds,
  shouldAutomaticallyMarkConversationRead,
  type ConversationActivityAction,
} from "./conversation-activity";

export interface UseConversationActivityOptions {
  httpClient: AgentsClient;
  conversationIds: readonly string[];
  activeConversationId: string | null;
  readableMessageIds?: readonly string[];
  enabled: boolean;
  /** 读取终态不必然有权写回执，默认保持原行为。 */
  readReceiptEnabled?: boolean;
  pollingInterval?: number;
  pollingWhenHidden?: boolean;
  onTerminalChange?: (
    conversationId: string,
    messageId: string,
  ) => void | Promise<void>;
}

/** 管理串行摘要查询、执行终态确认和已展示消息的精确已读回执。 */
export function useConversationActivity({
  httpClient,
  conversationIds,
  activeConversationId,
  readableMessageIds = [],
  enabled,
  readReceiptEnabled = true,
  pollingInterval = 5000,
  pollingWhenHidden = false,
  onTerminalChange,
}: UseConversationActivityOptions) {
  const signal=useAiChatRequestSignal(httpClient);
  const idsKey = JSON.stringify(normalizeConversationIds(conversationIds));
  const ids = useMemo<string[]>(() => JSON.parse(idsKey), [idsKey]);
  const idsRef = useLatest(ids);
  const enabledRef = useLatest(enabled);
  const receiptEnabledRef = useLatest(readReceiptEnabled);
  const activeIdRef = useLatest(activeConversationId);
  const readableIdsRef = useLatest(readableMessageIds);
  const terminalChangeRef = useLatest(onTerminalChange);
  const visibility = useDocumentVisibility();
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState(createConversationActivityState);
  const [discoveredActiveIds, setDiscoveredActiveIds] = useState<string[]>([]);
  const [serverUnreadConversationIds, setServerUnreadConversationIds] =
    useState<ReadonlySet<string>>(() => new Set());
  const stateRef = useRef(state);
  const discoveredActiveIdsRef = useRef<string[]>([]);
  const sequence = useRef(0);
  const activeSequence = useRef(0);
  const unreadSequence = useRef(0);
  const lifecycle = useRef(0);
  const removedIds = useRef(new Set<string>());
  const readGeneration = useRef(0);
  const [fresh, setFresh] = useState<{ id: string; generation: number } | null>(
    null,
  );
  const blockedReads = useRef(new Map<string, number>());
  const pendingIds = useRef(new Set<string>());
  const retryReadIds = useRef(new Set<string>());
  const queryFlight = useRef<Promise<void> | null>(null);
  const readTail = useRef<Promise<void>>(Promise.resolve());
  const pendingReads = useRef(new Map<string, Promise<void>>());

  // 同一事件循环中的开始、完成、查询必须基于最新状态归并，不能等待下一次渲染。
  const commit = useMemoizedFn((action: ConversationActivityAction) => {
    stateRef.current = conversationActivityReducer(stateRef.current, action);
    setState(stateRef.current);
  });
  const query = useApiRequest(
    async (requestedIds: string[]) => {
      const operationId = ++sequence.current;
      const generation = readGeneration.current;
      const response = await requestConversationActivities(
        httpClient,
        requestedIds,
        {signal},
      );
      return { activities: response.records, operationId, generation };
    },
    { manual: true, disableErrorNotification: true },
  );
  const read = useApiRequest(
    (id: string, messageId: string) =>
      markConversationRead(httpClient, id, messageId,{signal}),
    { manual: true, disableErrorNotification: true },
  );
  const activeConversations = useApiRequest(
    () => requestActiveConversations(httpClient,{signal}),
    { manual: true, disableErrorNotification: true },
  );
  const unreadConversations = useApiRequest(
    () => requestUnreadConversations(httpClient,{signal}),
    { manual: true, disableErrorNotification: true },
  );

  /** 使用完整服务端快照替换未读会话集合，并丢弃迟到响应。 */
  const refreshUnread = useMemoizedFn(async (): Promise<void> => {
    if (!enabledRef.current) return;
    const life = lifecycle.current;
    const operationId = ++unreadSequence.current;
    const response = await unreadConversations.runAsync();
    if (
      life !== lifecycle.current ||
      operationId !== unreadSequence.current ||
      !enabledRef.current
    )
      return;
    setServerUnreadConversationIds(new Set(response.conversationIds));
  });
  const removeUnreadConversation = useMemoizedFn((id: string) => {
    setServerUnreadConversationIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  });

  const enqueueQuery = useMemoizedFn(
    (
      requestedIds: readonly string[],
      allowReadRetry: boolean,
    ): Promise<void> => {
      if (!enabledRef.current) return Promise.resolve();
      normalizeConversationIds(requestedIds).forEach((id) => {
        if (removedIds.current.has(id)) return;
        pendingIds.current.add(id);
        if (allowReadRetry) retryReadIds.current.add(id);
      });
      if (queryFlight.current) return queryFlight.current;
      const life = lifecycle.current;
      const flight = (async () => {
        // 合并首次加载、目标会话变更等同一轮触发，但事件之后的刷新仍会形成下一批请求。
        await Promise.resolve();
        let failure: unknown;
        while (
          life === lifecycle.current &&
          enabledRef.current &&
          pendingIds.current.size
        ) {
          const requested = [...pendingIds.current];
          pendingIds.current.clear();
          const canRetryRead = new Set(retryReadIds.current);
          retryReadIds.current.clear();
          try {
            const result = await query.runAsync(requested);
            failure = undefined;
            if (life !== lifecycle.current) return;
            const retained = requested.filter(
              (id) => !removedIds.current.has(id),
            );
            const previous = stateRef.current.serverByConversationId;
            commit({
              type: "snapshot-succeeded",
              requestedConversationIds: retained,
              ...result,
            });
            for (const id of retained) {
              if (
                stateRef.current.lastOperationByConversationId.get(id) !==
                result.operationId
              )
                continue;
              const activity = stateRef.current.serverByConversationId.get(id);
              const old = previous.get(id);
              if (
                old &&
                activity?.latestTerminalMessageId &&
                old.latestTerminalMessageId !== activity.latestTerminalMessageId
              ) {
                void Promise.resolve(
                  terminalChangeRef.current?.(
                    id,
                    activity.latestTerminalMessageId,
                  ),
                ).catch(console.error);
              }
              if (
                canRetryRead.has(id) &&
                result.operationId > (blockedReads.current.get(id) ?? 0)
              ) {
                blockedReads.current.delete(id);
              }
              if (
                activity &&
                id === activeIdRef.current &&
                result.generation === readGeneration.current
              ) {
                setFresh({ id, generation: result.generation });
              }
            }
          } catch (error) {
            if (life !== lifecycle.current || !enabledRef.current) return;
            // 保留已确认摘要和待终态目标；周期轮询或下一次强制刷新负责重试。
            failure = error;
          }
        }
        if (
          failure &&
          life === lifecycle.current &&
          enabledRef.current
        ) {
          throw failure;
        }
      })().finally(() => {
        if (queryFlight.current === flight) queryFlight.current = null;
      });
      queryFlight.current = flight;
      return flight;
    },
  );

  /** 强制查询指定会话，不受活动轮询筛选限制。 */
  const refresh = useMemoizedFn((requestedIds: readonly string[]) =>
    enqueueQuery(requestedIds, true),
  );
  /**
   * 重新发现全部未结束会话，并查询新增及刚从活动集合退出的会话。
   *
   * 后者需要最后确认一次终态，避免活动发现与摘要轮询之间的完成竞态。
   */
  const refreshActive = useMemoizedFn(async (): Promise<void> => {
    if (!enabledRef.current) return;
    const life = lifecycle.current;
    const operationId = ++activeSequence.current;
    const response = await activeConversations.runAsync();
    if (
      life !== lifecycle.current ||
      operationId !== activeSequence.current ||
      !enabledRef.current
    )
      return;

    const nextIds = normalizeConversationIds(response.conversationIds).filter(
      (id) => !removedIds.current.has(id),
    );
    const requestedIds = normalizeConversationIds([
      ...discoveredActiveIdsRef.current,
      ...nextIds,
    ]);
    await enqueueQuery(requestedIds, false);
    if (
      life !== lifecycle.current ||
      operationId !== activeSequence.current ||
      !enabledRef.current
    )
      return;

    discoveredActiveIdsRef.current = nextIds;
    setDiscoveredActiveIds(nextIds);
  });
  const pollIds = normalizeConversationIds([
    ...selectConversationActivityPollingIds(state, ids),
    ...discoveredActiveIds,
  ]);
  const polling = enabled && pollIds.length > 0;
  const poll = useApiRequest(
    () =>
      enqueueQuery(
        normalizeConversationIds([
          ...selectConversationActivityPollingIds(
            stateRef.current,
            idsRef.current,
          ),
          ...discoveredActiveIdsRef.current,
        ]),
        false,
      ),
    {
      manual: true,
      pollingInterval: polling ? pollingInterval : undefined,
      pollingWhenHidden,
      pollingSilentLoading: true,
      disableErrorNotification: true,
    },
  );
  const { run: runPoll, cancel: cancelPoll } = poll;
  useEffect(() => {
    if (polling && (pollingWhenHidden || visibility === "visible")) runPoll();
    else cancelPoll();
    return cancelPoll;
  }, [polling, pollingWhenHidden, visibility, runPoll, cancelPoll]);

  const invalidateRead = useMemoizedFn(() => {
    readGeneration.current += 1;
    setFresh(null);
  });
  const confirmTarget = useMemoizedFn(() => {
    if (activeConversationId && enabled) {
      void refresh([activeConversationId]).catch(() => {
        // 刷新失败时保持不可自动已读，后续同步继续确认。
      });
    }
  });
  useEffect(() => {
    invalidateRead();
    setFocused(document.hasFocus());
    if (visibility === "visible") confirmTarget();
  }, [
    activeConversationId,
    enabled,
    visibility,
    confirmTarget,
    invalidateRead,
  ]);
  useEventListener("blur", () => {
    setFocused(false);
    invalidateRead();
  });
  useEventListener("focus", () => {
    setFocused(true);
    invalidateRead();
    confirmTarget();
  });

  const markRead = useMemoizedFn(
    (id: string, messageId: string): Promise<void> => {
      if (!receiptEnabledRef.current) return Promise.resolve();
      const key = `${id}\u0000${messageId}`;
      const pending = pendingReads.current.get(key);
      if (pending) return pending;
      const generation = readGeneration.current;
      const life = lifecycle.current;
      const promise = readTail.current
        .then(async () => {
          if (
            life !== lifecycle.current ||
            !enabledRef.current ||
            !receiptEnabledRef.current ||
            removedIds.current.has(id) ||
            generation !== readGeneration.current ||
            id !== activeIdRef.current ||
            !readableIdsRef.current.includes(messageId) ||
            selectConversationActivities(stateRef.current).get(id)
              ?.latestTerminalMessageId !== messageId ||
            selectConversationActivities(stateRef.current).get(id)
              ?.executionStatus !== "IDLE" ||
            document.visibilityState !== "visible" ||
            !document.hasFocus()
          )
            return;
          commit({ type: "read-started", conversationId: id, messageId });
          const operationId = ++sequence.current;
          try {
            const activity = await read.runAsync(id, messageId);
            if (life === lifecycle.current && !removedIds.current.has(id)) {
              removeUnreadConversation(id);
              commit({ type: "read-succeeded", activity, operationId });
              void refreshUnread().catch(() => {
                // 已读回执已经成功，未读集合由下一次同步继续收敛。
              });
            }
          } catch (error) {
            if (life === lifecycle.current && !removedIds.current.has(id)) {
              blockedReads.current.set(id, ++sequence.current);
              commit({ type: "read-failed", conversationId: id, messageId });
              void refreshUnread().catch(() => {
                // 乐观已读已回滚，保留旧集合并等待下一次同步。
              });
            }
            throw error;
          }
        })
        .finally(() => {
          if (pendingReads.current.get(key) === promise)
            pendingReads.current.delete(key);
          if (life === lifecycle.current)
            setFresh((current) => (current ? { ...current } : null));
        });
      // 不同会话的写请求也串行，失败只阻断当前回执，不取消其他回执。
      readTail.current = promise.catch(() => undefined);
      pendingReads.current.set(key, promise);
      return promise;
    },
  );

  const handleConversationStart = useMemoizedFn(
    (id: string, messageId: string) => {
      if (!id || !messageId || !enabledRef.current) return;
      commit({
        type: "conversation-started",
        conversationId: id,
        messageId,
        operationId: ++sequence.current,
      });
      void enqueueQuery([id], false).catch(() => {
        // 本地运行态保留，后续轮询再次确认。
      });
    },
  );
  const handleConversationComplete = useMemoizedFn(
    async (id: string, messageId: string) => {
      if (
        !id ||
        !messageId ||
        !enabledRef.current ||
        removedIds.current.has(id)
      )
        return;
      commit({
        type: "conversation-completed",
        conversationId: id,
        messageId,
        operationId: ++sequence.current,
      });
      await Promise.all([
        enqueueQuery([id], false),
        refreshUnread().catch(() => {
          // 活动摘要仍可确认终态，未读集合由下一次同步继续收敛。
        }),
      ]);
    },
  );
  const removeConversation = useMemoizedFn((id: string) => {
    removedIds.current.add(id);
    pendingIds.current.delete(id);
    retryReadIds.current.delete(id);
    blockedReads.current.delete(id);
    const nextActiveIds = discoveredActiveIdsRef.current.filter(
      (conversationId) => conversationId !== id,
    );
    discoveredActiveIdsRef.current = nextActiveIds;
    setDiscoveredActiveIds(nextActiveIds);
    unreadSequence.current += 1;
    removeUnreadConversation(id);
    commit({ type: "remove-conversation", conversationId: id });
  });

  useEffect(() => {
    if (!enabled) {
      stateRef.current = createConversationActivityState();
      setState(stateRef.current);
      discoveredActiveIdsRef.current = [];
      setDiscoveredActiveIds([]);
      unreadSequence.current += 1;
      setServerUnreadConversationIds(new Set());
      removedIds.current.clear();
      blockedReads.current.clear();
      return;
    }
    commit({ type: "retain-conversations", conversationIds: ids });
  }, [ids, enabled, commit]);
  const { cancel: cancelQuery } = query;
  const { cancel: cancelRead } = read;
  const { cancel: cancelActiveConversations } = activeConversations;
  const { cancel: cancelUnreadConversations } = unreadConversations;
  useEffect(
    () => () => {
      lifecycle.current += 1;
      pendingIds.current.clear();
      retryReadIds.current.clear();
      queryFlight.current = null;
      pendingReads.current.clear();
      readTail.current = Promise.resolve();
      discoveredActiveIdsRef.current = [];
      cancelQuery();
      cancelRead();
      cancelActiveConversations();
      cancelUnreadConversations();
    },
    [
      enabled,
      cancelQuery,
      cancelRead,
      cancelActiveConversations,
      cancelUnreadConversations,
    ],
  );

  const activityByConversationId = useMemo(
    () => selectConversationActivities(state),
    [state],
  );
  const unreadConversationIds = useMemo<ReadonlySet<string>>(() => {
    const next = new Set(serverUnreadConversationIds);
    state.optimisticReadByConversationId.forEach(
      (messageId, conversationId) => {
        if (
          state.serverByConversationId.get(conversationId)
            ?.latestTerminalMessageId === messageId
        ) {
          next.delete(conversationId);
        }
      },
    );
    return next;
  }, [serverUnreadConversationIds, state]);
  useEffect(() => {
    if (!readReceiptEnabled || !activeConversationId || blockedReads.current.has(activeConversationId))
      return;
    const activity = activityByConversationId.get(activeConversationId);
    if (
      !shouldAutomaticallyMarkConversationRead({
        activity,
        activeConversationId,
        enabled,
        readableMessageIds,
        snapshotReady:
          fresh?.id === activeConversationId &&
          fresh.generation === readGeneration.current,
        pageVisible: visibility === "visible",
        windowFocused: focused && document.hasFocus(),
      }) ||
      !activity?.latestTerminalMessageId
    )
      return;
    void markRead(activeConversationId, activity.latestTerminalMessageId).catch(
      () => {
        // 已回滚精确消息的乐观已读，等待下一次强制同步后重试。
      },
    );
  }, [
    activeConversationId,
    readReceiptEnabled,
    activityByConversationId,
    enabled,
    readableMessageIds,
    fresh,
    visibility,
    focused,
    markRead,
  ]);

  return {
    activityByConversationId,
    unreadConversationIds,
    loading:
      query.loading ||
      activeConversations.loading ||
      unreadConversations.loading,
    error:
      query.error ?? activeConversations.error ?? unreadConversations.error,
    refresh,
    refreshActive,
    refreshUnread,
    markRead,
    handleConversationStart,
    handleConversationComplete,
    removeConversation,
  };
}
