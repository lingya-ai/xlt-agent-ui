"use client";

import { useEffect, useRef, useState } from "react";
import { useDocumentVisibility, useMemoizedFn } from "ahooks";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import {ApiError} from "@lingya-ai/agents-sdk/browser";
import {SubagentTaskStatus, sortSubagentTasks, subagentSyncInputSchema, type SubagentTask} from "./subagent-schema";

const SYNC_SIZE = 50;

interface SubagentSnapshot {
  client: AgentsClient;
  conversationId?: string;
  tasks: SubagentTask[];
  loaded: boolean;
  unread: boolean;
  polling: boolean;
  error?: Error;
}

/** 单个会话独立对账子任务，满页继续消费，游标只在数据合并后推进。 */
export function useSubagentTasks({
  httpClient,
  conversationId,
  ready,
  executionActive,
}: {
  httpClient: AgentsClient;
  conversationId?: string;
  ready: boolean;
  executionActive: boolean;
}) {
  const visibility = useDocumentVisibility();
  const [snapshot, setSnapshot] = useState<SubagentSnapshot>();
  const generation = useRef(0);
  const cursor = useRef<string | null>(null);
  const taskMap = useRef(new Map<string, SubagentTask>());
  const flight = useRef<Promise<void> | null>(null);
  const abort = useRef<AbortController | undefined>(undefined);
  const latest = useRef({ httpClient, conversationId, ready, visibility });
  latest.current = { httpClient, conversationId, ready, visibility };

  const synchronize = useMemoizedFn(async () => {
    if (!conversationId || !ready || visibility !== "visible") return;
    if (flight.current) return flight.current;
    const currentGeneration = generation.current;
    const controller = new AbortController();
    abort.current = controller;
    const current = () =>
      !controller.signal.aborted &&
      currentGeneration === generation.current &&
      latest.current.conversationId === conversationId &&
      latest.current.httpClient === httpClient &&
      latest.current.ready &&
      latest.current.visibility === "visible";
    const operation = (async () => {
      let cursorReset = false;
      try {
        while (current()) {
          let response;
          try {
            response = await httpClient.messages.syncConversationSubagents(conversationId, {...(subagentSyncInputSchema.parse({
                  cursor: cursor.current ?? undefined,
                  size: SYNC_SIZE,
                })), signal: controller.signal});
          } catch (error) {
            if (
              current() &&
              error instanceof ApiError &&
              error.code === "ai.subagent.cursor_invalid" &&
              !cursorReset
            ) {
              cursor.current = null;
              cursorReset = true;
              continue;
            }
            throw error;
          }
          if (!current()) return;
          for (const task of [
            ...response.changedTasks,
            ...response.activeTasks,
          ])
            taskMap.current.set(task.taskId, task);
          const fullPage = response.changedTasks.length === SYNC_SIZE;
          if (
            fullPage &&
            (!response.nextCursor || response.nextCursor === cursor.current)
          ) {
            throw new Error("子任务同步游标无法推进");
          }
          cursor.current = response.nextCursor;
          setSnapshot({
            client: httpClient,
            conversationId,
            tasks: sortSubagentTasks([...taskMap.current.values()]),
            loaded: true,
            unread: response.hasUnreadTerminalResults,
            polling: response.pollingRequired,
          });
          if (!fullPage) break;
        }
      } catch (error) {
        if (!current()) return;
        setSnapshot((previous) => ({
          client: httpClient,
          conversationId,
          tasks: previous?.tasks ?? [],
          loaded: previous?.loaded ?? false,
          unread: previous?.unread ?? false,
          polling: true,
          error: error instanceof Error ? error : new Error("子任务同步失败"),
        }));
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

  const visible =
    ready &&
    snapshot?.client === httpClient &&
    snapshot.conversationId === conversationId;
  const { runAsync, cancel, loading } = useApiRequest(synchronize, {
    manual: true,
    pollingInterval:
      ready && (executionActive || (visible && snapshot.polling))
        ? 3000
        : undefined,
    pollingWhenHidden: false,
    pollingSilentLoading: true,
    disableErrorNotification: true,
  });
  const refresh = useMemoizedFn(async () => {
    try {
      await runAsync();
    } catch {
      // 同步错误已保存在当前会话快照，面板提供重试；后台轮询不重复弹 Toast。
    }
  });

  const updateTask = useMemoizedFn((task: SubagentTask) => {
    if (!ready || task.parentConversationId !== conversationId || !visible)
      return;
    taskMap.current.set(task.taskId, task);
    setSnapshot((previous) =>
      previous
        ? {
            ...previous,
            tasks: sortSubagentTasks([...taskMap.current.values()]),
          }
        : previous,
    );
  });

  useEffect(() => {
    generation.current += 1;
    abort.current?.abort();
    cancel();
    flight.current = null;
    cursor.current = null;
    taskMap.current.clear();
    setSnapshot(undefined);
    return () => {
      generation.current += 1;
      abort.current?.abort();
      cancel();
    };
  }, [httpClient, conversationId, ready, cancel]);

  useEffect(() => {
    let active = true;
    if (ready && conversationId && visibility === "visible") {
      void Promise.resolve().then(() => {
        if (active) void refresh();
      });
    } else {
      abort.current?.abort();
      flight.current = null;
      cancel();
    }
    return () => {
      active = false;
      cancel();
    };
  }, [
    ready,
    conversationId,
    httpClient,
    executionActive,
    visibility,
    refresh,
    cancel,
  ]);

  const tasks = visible ? snapshot.tasks : [];
  return {
    tasks,
    activeCount: tasks.filter(
      (task) => task.status === SubagentTaskStatus.RUNNING,
    ).length,
    hasUnreadTerminalResults: visible && snapshot.unread,
    loaded: !conversationId || (visible && snapshot.loaded),
    loading:
      ready &&
      Boolean(conversationId) &&
      (loading || (!visible && !snapshot?.error)),
    error: visible ? snapshot.error : undefined,
    refresh,
    updateTask,
  };
}

export type SubagentTasksState = ReturnType<typeof useSubagentTasks>;
