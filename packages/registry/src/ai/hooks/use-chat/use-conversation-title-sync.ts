"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import type {ApiError} from "@lingya-ai/agents-sdk/browser";

import {
  CONVERSATION_TITLE_POLLING_INTERVAL,
  CONVERSATION_TITLE_SYNC_TIMEOUT,
  createLocalConversationTitle,
  isKnownConversationTitleState,
  isTerminalConversationTitleState,
  type ConversationTitle,
  type ConversationTitleState,
} from "./conversation-title";
import { useConversationOperations } from "./use-conversation-operations";

export interface ConversationTitleSyncItem {
  conversationId: string;
  title?: string | null;
  titleState?: string;
}

export interface ConversationTitleSyncUpdate extends ConversationTitle {
  source: "server" | "local-timeout";
}

interface ConversationTitleTask {
  conversationId: string;
  fallbackTitle: string;
  lastState?: ConversationTitleState;
  startedAt: number;
}

type ConversationTitlePollResult =
  | { conversationId: string; data: ConversationTitle; error?: never }
  | { conversationId: string; data?: never; error: unknown };

interface UseConversationTitleSyncOptions {
  httpClient: AgentsClient;
  unnamedTitle: string;
  onTitleChange: (update: ConversationTitleSyncUpdate) => void;
}

function getErrorStatus(error: unknown): number | undefined {
  return (error as Partial<ApiError> | null)?.status;
}

function isSchemaValidationError(error: unknown): boolean {
  return (error as Partial<ApiError> | null)?.kind === 'protocol';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** 同步后端异步生成的会话标题，并在超时后提供当前浏览器会话内的本地兜底。 */
export function useConversationTitleSync({
  httpClient,
  unnamedTitle,
  onTitleChange,
}: UseConversationTitleSyncOptions) {
  const tasksRef = useRef(new Map<string, ConversationTitleTask>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const onTitleChangeRef = useRef(onTitleChange);
  const mountedRef = useRef(true);
  const [taskVersion, setTaskVersion] = useState(0);
  onTitleChangeRef.current = onTitleChange;
  const { getConversationTitle } = useConversationOperations({ httpClient });

  const touchTasks = useCallback(() => {
    if (mountedRef.current) setTaskVersion((version) => version + 1);
  }, []);

  const removeTask = useCallback(
    (conversationId: string) => {
      controllersRef.current.get(conversationId)?.abort();
      controllersRef.current.delete(conversationId);
      if (tasksRef.current.delete(conversationId)) touchTasks();
    },
    [touchTasks],
  );

  const pollTitles = useCallback(async (): Promise<
    ConversationTitlePollResult[]
  > => {
    const tasks = Array.from(tasksRef.current.values());
    return Promise.all(
      tasks.map(async (task) => {
        controllersRef.current.get(task.conversationId)?.abort();
        const controller = new AbortController();
        controllersRef.current.set(task.conversationId, controller);

        try {
          const data = await getConversationTitle(
            task.conversationId,
            controller.signal,
          );
          return { conversationId: task.conversationId, data };
        } catch (error) {
          return { conversationId: task.conversationId, error };
        } finally {
          if (controllersRef.current.get(task.conversationId) === controller) {
            controllersRef.current.delete(task.conversationId);
          }
        }
      }),
    );
  }, [getConversationTitle]);

  const request = useApiRequest(pollTitles, {
    manual: true,
    pollingInterval: CONVERSATION_TITLE_POLLING_INTERVAL,
    pollingWhenHidden: false,
    pollingSilentLoading: true,
    disableErrorNotification: true,
    onSuccess: (results) => {
      const now = Date.now();
      results.forEach((result) => {
        const task = tasksRef.current.get(result.conversationId);
        if (!task) return;

        if ("error" in result) {
          if (isAbortError(result.error)) return;
          const status = getErrorStatus(result.error);
          if (status === 401) {
            controllersRef.current.forEach((controller) => controller.abort());
            controllersRef.current.clear();
            tasksRef.current.clear();
            touchTasks();
            return;
          }
          const shouldStop =
            status === 404 ||
            (status !== undefined && status >= 400 && status < 500) ||
            isSchemaValidationError(result.error);
          if (shouldStop) {
            console.error("会话标题同步已停止", result.error);
            removeTask(result.conversationId);
            return;
          }
        } else {
          task.lastState = result.data.titleState;
          onTitleChangeRef.current({ ...result.data, source: "server" });
          if (isTerminalConversationTitleState(result.data.titleState)) {
            removeTask(result.conversationId);
            return;
          }
          if (!isKnownConversationTitleState(result.data.titleState)) {
            console.warn(`收到未知会话标题状态：${result.data.titleState}`);
            removeTask(result.conversationId);
            return;
          }
        }

        if (now - task.startedAt >= CONVERSATION_TITLE_SYNC_TIMEOUT) {
          onTitleChangeRef.current({
            conversationId: task.conversationId,
            title: task.fallbackTitle,
            titleState: task.lastState ?? "GENERATING",
            source: "local-timeout",
          });
          removeTask(task.conversationId);
        }
      });
    },
  });
  const { cancel, run } = request;

  useEffect(() => {
    if (tasksRef.current.size > 0) run();
    else cancel();
  }, [cancel, run, taskVersion]);

  const start = useCallback(
    ({
      conversationId,
      firstUserMessage,
      currentTitle,
    }: {
      conversationId: string;
      firstUserMessage: string;
      currentTitle?: string | null;
    }) => {
      if (tasksRef.current.has(conversationId)) return;
      tasksRef.current.set(conversationId, {
        conversationId,
        fallbackTitle: createLocalConversationTitle(
          firstUserMessage,
          currentTitle?.trim() || unnamedTitle,
        ),
        startedAt: Date.now(),
      });
      touchTasks();
    },
    [touchTasks, unnamedTitle],
  );

  const resume = useCallback(
    (items: readonly ConversationTitleSyncItem[]) => {
      let changed = false;
      items.forEach((item) => {
        if (
          item.titleState !== "GENERATING" ||
          tasksRef.current.has(item.conversationId)
        )
          return;
        tasksRef.current.set(item.conversationId, {
          conversationId: item.conversationId,
          fallbackTitle: item.title?.trim() || unnamedTitle,
          lastState: item.titleState,
          startedAt: Date.now(),
        });
        changed = true;
      });
      if (changed) touchTasks();
    },
    [touchTasks, unnamedTitle],
  );

  const stopAll = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    if (tasksRef.current.size > 0) {
      tasksRef.current.clear();
      touchTasks();
    }
    cancel();
  }, [cancel, touchTasks]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
      tasksRef.current.clear();
      cancel();
    },
    [cancel],
  );

  return useMemo(
    () => ({ start, resume, stop: removeTask, stopAll }),
    [removeTask, resume, start, stopAll],
  );
}
