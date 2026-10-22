"use client";

import { useEffect, useRef, useState } from "react";
import { useDocumentVisibility, useMemoizedFn } from "ahooks";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import {ApiError} from "@lingya-ai/agents-sdk/browser";
import {ConversationMessageStatus, hasReplayableMessageEvents} from "./conversation-message";
import { pickMessageStatistics } from "./message-metadata";
import { isSubagentActive, type SubagentTask } from "./subagent-schema";
import type { ChatStreamTransport } from "./chat-stream-transport";
import { useChatEventsBatch } from "./use-chat-events-batch";
import { useChatMessages } from "./use-chat-messages";

/** 当前选中子任务的只读消息生命周期，不运行根会话的提交和任务同步逻辑。 */
export function useSubagentConversation({
  httpClient,
  task,
  streamTransport,
}: {
  httpClient: AgentsClient;
  task: SubagentTask;
  streamTransport?: ChatStreamTransport;
}) {
  const visibility = useDocumentVisibility();
  const stream = useChatMessages({ httpClient, streamTransport });
  const {
    chatList,
    chatListRef,
    updateChatList,
    resubscribeStream,
    abortAllStreams,
  } = stream;
  const getEvents = useChatEventsBatch({ httpClient });
  const [loaded, setLoaded] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [conversationError, setConversationError] = useState<Error>();
  const generation = useRef(0);
  const conversationAbort = useRef<AbortController | undefined>(undefined);
  const historicalKey = useRef<string | undefined>(undefined);
  const latest = useRef({ task, visibility, httpClient });
  latest.current = { task, visibility, httpClient };

  const loadConversation = useMemoizedFn(async () => {
    const { childConversationId, childMessageId } = task;
    if (visibility !== "visible") return;
    if (!childConversationId || !childMessageId) {
      setWaiting(isSubagentActive(task));
      setLoaded(!isSubagentActive(task));
      return;
    }
    const currentGeneration = generation.current;
    conversationAbort.current?.abort();
    const controller = new AbortController();
    conversationAbort.current = controller;
    const current = () =>
      !controller.signal.aborted &&
      currentGeneration === generation.current &&
      latest.current.task.taskId === task.taskId &&
      latest.current.httpClient === httpClient &&
      latest.current.visibility === "visible";
    try {
      const message = await httpClient.messages.getConversationMessage(childConversationId, childMessageId, {signal: controller.signal});
      if (!current()) return;
      setConversationError(undefined);
      const existing = chatListRef.current.find(
        (item) => item.id === childMessageId,
      );
      if (!existing) {
        updateChatList([
          {
            ...pickMessageStatistics(message),
            id: message.messageId,
            user: message.userMessage,
            status: message.status,
            executionType: message.executionType,
            parentMessageId: message.parentMessageId,
            assistant: [],
            loading: message.status === ConversationMessageStatus.PENDING,
            loaded: false,
            startedAt: new Date(message.createdTime).getTime(),
          },
        ]);
      }
      if (message.status === ConversationMessageStatus.QUEUED) {
        setWaiting(true);
        setLoaded(true);
        return;
      }
      if (message.status === ConversationMessageStatus.PENDING) {
        resubscribeStream({
          conversationId: childConversationId,
          messageId: childMessageId,
        });
        setWaiting(false);
        setLoaded(true);
        return;
      }
      const key = `${childConversationId}:${childMessageId}:${message.status}`;
      if (historicalKey.current !== key) {
        const response = hasReplayableMessageEvents(message.status)
          ? await getEvents(
              childConversationId,
              [childMessageId],
              controller.signal,
            )
          : undefined;
        if (!current()) return;
        if (
          response?.skipped.some((item) => item.messageId === childMessageId)
        ) {
          setWaiting(true);
          return;
        }
        const events = response?.records.find(
          (item) => item.messageId === childMessageId,
        )?.events;
        if (response && !events) throw new Error("子会话历史事件尚未返回");
        abortAllStreams();
        updateChatList([
          {
            ...pickMessageStatistics(message),
            id: message.messageId,
            user: message.userMessage,
            status: message.status,
            executionType: message.executionType,
            parentMessageId: message.parentMessageId,
            assistant: events ?? [],
            loading: false,
            loaded: true,
            startedAt: new Date(message.createdTime).getTime(),
          },
        ]);
        historicalKey.current = key;
      }
      setWaiting(false);
      setLoaded(true);
    } catch (error) {
      if (!current()) return;
      // 准入前子消息还不存在，继续等待任务状态，不把排队误判成执行失败。
      if (error instanceof ApiError && error.status === 404) {
        setWaiting(isSubagentActive(task));
        setLoaded(!isSubagentActive(task));
        return;
      }
      setConversationError(
        error instanceof Error ? error : new Error("子对话加载失败"),
      );
      throw error;
    }
  });

  const conversationRequest = useApiRequest(loadConversation, {
    manual: true,
    pollingInterval: waiting ? 3000 : undefined,
    pollingWhenHidden: false,
    pollingSilentLoading: true,
    disableErrorNotification: true,
  });
  const reload = useMemoizedFn(async () => {
    try {
      await conversationRequest.runAsync();
    } catch {
      // 详情区域展示错误和重试入口，不额外重复通知。
    }
  });

  const cancelConversation = conversationRequest.cancel;
  useEffect(() => {
    generation.current += 1;
    historicalKey.current = undefined;
    setLoaded(false);
    setWaiting(true);
    setConversationError(undefined);
    updateChatList([]);
    return () => {
      generation.current += 1;
      conversationAbort.current?.abort();
      cancelConversation();
      abortAllStreams();
    };
  }, [
    httpClient,
    task.taskId,
    abortAllStreams,
    cancelConversation,
    updateChatList,
  ]);

  useEffect(() => {
    let active = true;
    if (visibility === "visible") {
      void Promise.resolve().then(() => {
        if (active) {
          void reload();
        }
      });
    } else {
      generation.current += 1;
      conversationAbort.current?.abort();
      cancelConversation();
      abortAllStreams();
    }
    return () => {
      active = false;
    };
  }, [
    task.taskId,
    task.status,
    task.childConversationId,
    task.childMessageId,
    visibility,
    reload,
    cancelConversation,
    abortAllStreams,
  ]);

  return {
    chatList,
    loaded,
    waiting,
    error: conversationError,
    loading: conversationRequest.loading,
    reload,
  };
}
