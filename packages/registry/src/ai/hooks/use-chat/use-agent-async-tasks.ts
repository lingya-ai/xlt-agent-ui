"use client";
import type {AsyncTask as AgentAsyncTask} from '@lingya-ai/agents-sdk/browser';
export type {AsyncTask as AgentAsyncTask} from '@lingya-ai/agents-sdk/browser';


import {useEffect, useRef, useState} from "react";
import {useDocumentVisibility, useMemoizedFn} from "ahooks";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useApiRequest} from "../../../api/hooks/use-api-request";
import {type ConversationMessageOutput} from "./conversation-message";

const ASYNC_TASK_SYNC_PAGE_SIZE = 50;

/**
 * 增量同步活动任务和通知消息。
 *
 * 正在执行普通会话消息时保持固定轮询，以发现执行过程中创建的异步任务；后端状态决定普通消息
 * 结束后是否继续轮询。游标只会在通知消息成功合并后推进。
 */
export function useAgentAsyncTasks({
  httpClient,
  conversationId,
  initialCursorMessageId,
  ready,
  executionActive,
  onSynchronize,
}: {
  httpClient: AgentsClient;
  conversationId?: string;
  initialCursorMessageId?: string | null;
  ready: boolean;
  executionActive: boolean;
  /** 返回 false 表示当前不能合并消息，游标保持不变并继续重试。 */
  onSynchronize: (messages: ConversationMessageOutput[]) => Promise<void | false>;
}) {
  const [tasks, setTasks] = useState<AgentAsyncTask[]>([]);
  const [pollingRequired, setPollingRequired] = useState(false);
  const visibility = useDocumentVisibility();
  const generation = useRef(0);
  const cursor = useRef<string | null>(null);
  const cursorInitialized = useRef(false);
  const flight = useRef<Promise<void> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef({conversationId, executionActive, onSynchronize, ready, visibility});
  latest.current = {conversationId, executionActive, onSynchronize, ready, visibility};

  const refresh = useMemoizedFn(async (): Promise<void> => {
    if (!conversationId || !ready || visibility !== "visible") return;
    if (flight.current) {
      await flight.current;
      return;
    }
    if (!cursorInitialized.current) {
      cursor.current = initialCursorMessageId ?? null;
      cursorInitialized.current = true;
    }

    const current = generation.current;
    const controller = new AbortController();
    abort.current = controller;
    const operation = (async () => {
      try {
        let pageCursor = cursor.current;
        let continuePolling = false;
        while (true) {
          const response = await httpClient.messages.syncConversationAsyncTasks(conversationId, {...({
                afterMessageId: pageCursor ?? undefined,
                size: ASYNC_TASK_SYNC_PAGE_SIZE,
              }), signal: controller.signal});
          if (controller.signal.aborted || current !== generation.current ||
            conversationId !== latest.current.conversationId || latest.current.visibility !== "visible") return;

          setTasks(response.activeTasks);
          const synchronized = await latest.current.onSynchronize(response.notificationMessages);
          if (controller.signal.aborted || current !== generation.current ||
            conversationId !== latest.current.conversationId || latest.current.visibility !== "visible") return;
          if (synchronized === false) {
            setPollingRequired(true);
            return;
          }

          const nextCursor = response.nextMessageId ?? pageCursor;
          if (response.hasMore && nextCursor === pageCursor) {
            throw new Error("异步任务通知增量接口返回了无法推进的游标");
          }
          pageCursor = nextCursor;
          cursor.current = nextCursor;
          continuePolling = response.pollingRequired;
          if (!response.hasMore) break;
        }
        setPollingRequired(continuePolling);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (current === generation.current && conversationId === latest.current.conversationId) {
          setPollingRequired(true);
        }
        throw error;
      }
    })();
    flight.current = operation;
    try {
      await operation;
    } finally {
      if (flight.current === operation) flight.current = null;
    }
  });

  const polling = pollingRequired || executionActive;
  const request = useApiRequest(refresh, {
    manual: true,
    pollingInterval: polling ? 3000 : undefined,
    pollingWhenHidden: false,
    pollingSilentLoading: true,
    disableErrorNotification: true,
  });
  const {run, cancel} = request;

  useEffect(() => {
    const current = ++generation.current;
    abort.current?.abort();
    flight.current = null;
    cursor.current = null;
    cursorInitialized.current = false;
    setTasks([]);
    setPollingRequired(false);
    return () => {
      generation.current = current + 1;
      abort.current?.abort();
      cancel();
    };
  }, [conversationId, httpClient, cancel]);

  useEffect(() => {
    if (conversationId && ready && visibility === "visible") {
      run();
    } else {
      abort.current?.abort();
      cancel();
    }
    return cancel;
  }, [conversationId, initialCursorMessageId, ready, executionActive, visibility, run, cancel]);

  return {tasks};
}
