"use client";

import {useEffect, useRef, useState} from "react";
import {useMemoizedFn, useTimeout} from "ahooks";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useApiRequest} from "../../../api/hooks/use-api-request";
import {ApiError} from "@lingya-ai/agents-sdk/browser";

import {} from "./conversation-message";
import {hasSettledMessageStatistics, pickMessageStatistics, type MessageStatistics} from "./message-metadata";
import type {ChatItem} from "./types";

const MAX_ATTEMPTS = 3;

type MetadataTask = {conversationId: string; messageId: string; generation: number; revision: number; attempts: number};

type Options = {
  httpClient: AgentsClient;
  getMessage: (messageId: string) => ChatItem | undefined;
  patchMessage: (messageId: string, patch: MessageStatistics & Pick<ChatItem, "messageStatsPending">) => void;
};

/** 仅由真实 End 入队；串行、去重、有界重试，不扫描消息表，也不持续轮询。 */
export function useSettledMessageMetadata({httpClient, getMessage, patchMessage}: Options) {
  const scopeRef = useRef<string | undefined>(undefined);
  const generationRef = useRef(0);
  const queueRef = useRef<MetadataTask[]>([]);
  const seenRef = useRef(new Set<string>());
  const revisionsRef = useRef(new Map<string, number>());
  const runningRef = useRef(false);
  const activeRequestRef = useRef<{task: MetadataTask; controller: AbortController} | null>(null);
  const mountedRef = useRef(true);
  const scheduleRef = useRef(0);
  const [delay, setDelay] = useState<number | undefined>();
  const {runAsync} = useApiRequest((task: MetadataTask, signal: AbortSignal) => httpClient.messages.getConversationMessage(task.conversationId, task.messageId, {timeoutMs: 5000,signal}), {manual: true, disableErrorNotification: true});

  const schedule = useMemoizedFn((baseDelay: number) => {
    if (!mountedRef.current || runningRef.current || queueRef.current.length === 0) return;
    // 相邻单次调度保持不同 delay，避免极速响应被 React 批处理合并后丢失下一次任务。
    scheduleRef.current += 1;
    setDelay(baseDelay + scheduleRef.current % 2);
  });

  const isCurrentTask = useMemoizedFn((task: MetadataTask) => mountedRef.current &&
    task.generation === generationRef.current && task.revision === (revisionsRef.current.get(task.messageId) ?? 0));

  const processNext = useMemoizedFn(async () => {
    setDelay(undefined);
    const task = queueRef.current.shift();
    if (!task || runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    activeRequestRef.current = {task, controller};
    let retry = false;
    try {
      task.attempts += 1;
      const message = await runAsync(task, controller.signal);
      if (!isCurrentTask(task)) return;
      const item = getMessage(task.messageId);
      if (!item || item.loading || message.messageId !== task.messageId) return;
      if (hasSettledMessageStatistics(message)) {
        patchMessage(task.messageId, {...pickMessageStatistics(message), messageStatsPending: false});
      } else {
        retry = true;
      }
    } catch (error) {
      // 权限失败和主动取消不可重试；暂时失败只补统计，不改变流终态或打扰用户。
      const denied = error instanceof ApiError && (error.status === 401 || error.status === 403);
      retry = !denied && !controller.signal.aborted;
    } finally {
      if (activeRequestRef.current?.controller === controller) activeRequestRef.current = null;
      runningRef.current = false;
      const shouldRetry = isCurrentTask(task) && retry && task.attempts < MAX_ATTEMPTS;
      if (shouldRetry) queueRef.current.push(task);
      schedule(shouldRetry ? task.attempts * 500 : 0);
    }
  });
  useTimeout(() => {void processNext();}, delay);

  const reset = useMemoizedFn(() => {
    generationRef.current += 1;
    activeRequestRef.current?.controller.abort();
    scopeRef.current = undefined;
    queueRef.current = [];
    seenRef.current.clear();
    revisionsRef.current.clear();
    if (mountedRef.current) setDelay(undefined);
  });
  const beginScope = useMemoizedFn((conversationId: string) => {
    if (scopeRef.current === conversationId) return;
    reset();
    scopeRef.current = conversationId;
  });
  const beginMessage = useMemoizedFn((conversationId: string, messageId: string) => {
    beginScope(conversationId);
    revisionsRef.current.set(messageId, (revisionsRef.current.get(messageId) ?? 0) + 1);
    if (activeRequestRef.current?.task.messageId === messageId) activeRequestRef.current.controller.abort();
    seenRef.current.delete(messageId);
    queueRef.current = queueRef.current.filter(task => task.messageId !== messageId);
  });
  const notifyEnd = useMemoizedFn((conversationId: string, messageId: string) => {
    beginScope(conversationId);
    if (seenRef.current.has(messageId) || !getMessage(messageId)) return;
    seenRef.current.add(messageId);
    patchMessage(messageId, {messageStatsPending: true});
    queueRef.current.push({conversationId, messageId, generation: generationRef.current,
      revision: revisionsRef.current.get(messageId) ?? 0, attempts: 0});
    schedule(0);
  });

  useEffect(() => {
    mountedRef.current = true;
    const seen = seenRef.current;
    const revisions = revisionsRef.current;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      activeRequestRef.current?.controller.abort();
      queueRef.current = [];
      seen.clear();
      revisions.clear();
    };
  }, []);

  return {notifyEnd, beginMessage, reset};
}
