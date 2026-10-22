"use client";

import { useCallback, useEffect, useState } from "react";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";

import {
  buildConversationReplaySource,
  type ConversationReplaySource,
} from "./history-replay";
import type { AiChatEvent } from "./schema";
import type { ConversationMessageOutput } from "./conversation-message";
import { BATCH_MAX_SIZE, useChatEventsBatch } from "./use-chat-events-batch";
import { useConversationMessages } from "./use-conversation-messages";

const MESSAGE_PAGE_SIZE = 100;
const EVENT_BATCH_CONCURRENCY = 3;

export type ConversationReplayLoadProgress = {
  phase: "messages" | "events";
  loadedMessages: number;
  totalMessages?: number;
};

export type UseConversationReplaySourceOptions = {
  httpClient: AgentsClient;
  conversationId: string;
};

export type UseConversationReplaySourceResult = {
  source?: ConversationReplaySource;
  loading: boolean;
  loadProgress: ConversationReplayLoadProgress;
  error?: Error;
  reload: () => void;
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function chunkMessageIds(messageIds: string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < messageIds.length; index += BATCH_MAX_SIZE) {
    chunks.push(messageIds.slice(index, index + BATCH_MAX_SIZE));
  }
  return chunks;
}

function sortConversationMessages(
  messages: ConversationMessageOutput[],
): ConversationMessageOutput[] {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const leftTime = left.message.createdTime.getTime();
      const rightTime = right.message.createdTime.getTime();
      const normalizedLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
      const normalizedRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
      const timeDiff = normalizedLeftTime - normalizedRightTime;
      if (timeDiff !== 0) return timeDiff;

      const idDiff = left.message.messageId.localeCompare(
        right.message.messageId,
      );
      return idDiff === 0 ? left.index - right.index : idDiff;
    })
    .map(({ message }) => message);
}

/**
 * 为只读回放准备完整会话快照。
 *
 * 与 useChat 的视口懒加载不同，该 Hook 会在播放开始前读取全部消息和事件，
 * 从而保证总步骤和播放顺序在本次回放期间保持稳定。
 */
export function useConversationReplaySource({
  httpClient,
  conversationId,
}: UseConversationReplaySourceOptions): UseConversationReplaySourceResult {
  const getConversationMessages = useConversationMessages({ httpClient });
  const getChatEventsBatch = useChatEventsBatch({ httpClient });
  const [reloadGeneration, setReloadGeneration] = useState(0);
  const [source, setSource] = useState<ConversationReplaySource>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error>();
  const [loadProgress, setLoadProgress] =
    useState<ConversationReplayLoadProgress>({
      phase: "messages",
      loadedMessages: 0,
    });

  const reload = useCallback(() => {
    setReloadGeneration((generation) => generation + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const loadReplaySource = async () => {
      setSource(undefined);
      setError(undefined);
      setLoading(true);
      setLoadProgress({ phase: "messages", loadedMessages: 0 });

      try {
        const messageById = new Map<string, ConversationMessageOutput>();
        let currentPage = 0;
        let totalMessages: number | undefined;

        while (
          totalMessages === undefined ||
          messageById.size < totalMessages
        ) {
          const response = await getConversationMessages(conversationId, {
            current: currentPage,
            size: MESSAGE_PAGE_SIZE,
          });
          if (!active) return;

          response.records.forEach((message) => {
            messageById.set(message.messageId, message);
          });
          totalMessages = response.page.total;
          setLoadProgress({
            phase: "messages",
            loadedMessages: messageById.size,
            totalMessages,
          });

          if (
            response.records.length === 0 ||
            messageById.size >= totalMessages
          )
            break;
          currentPage += 1;
        }

        const messages = sortConversationMessages([...messageById.values()]);
        const messageIds = messages.map((message) => message.messageId);
        const batches = chunkMessageIds(messageIds);
        const eventsByMessageId = new Map<string, AiChatEvent[]>();
        const skippedMessageIds = new Set<string>();
        let nextBatchIndex = 0;
        let loadedEventMessages = 0;

        setLoadProgress({
          phase: "events",
          loadedMessages: 0,
          totalMessages: messageIds.length,
        });

        const loadNextBatch = async (): Promise<void> => {
          while (active) {
            const batchIndex = nextBatchIndex;
            nextBatchIndex += 1;
            const batch = batches[batchIndex];
            if (!batch) return;

            const response = await getChatEventsBatch(conversationId, batch);
            if (!active) return;

            response.records.forEach((record) => {
              eventsByMessageId.set(record.messageId, record.events);
            });
            response.skipped.forEach((record) => {
              skippedMessageIds.add(record.messageId);
            });

            loadedEventMessages += batch.length;
            setLoadProgress({
              phase: "events",
              loadedMessages: Math.min(loadedEventMessages, messageIds.length),
              totalMessages: messageIds.length,
            });
          }
        };

        const workerCount = Math.min(EVENT_BATCH_CONCURRENCY, batches.length);
        await Promise.all(
          Array.from({ length: workerCount }, () => loadNextBatch()),
        );
        if (!active) return;

        const missingMessageIds = messageIds.filter(
          (messageId) => !eventsByMessageId.has(messageId),
        );
        missingMessageIds.forEach((messageId) =>
          skippedMessageIds.add(messageId),
        );
        if (skippedMessageIds.size > 0) {
          throw new Error(
            `会话历史尚未准备完成：${[...skippedMessageIds].join(", ")}`,
          );
        }

        setSource(buildConversationReplaySource(messages, eventsByMessageId));
      } catch (loadError) {
        if (!active) return;
        const normalizedError = toError(loadError);
        console.error("加载会话回放历史失败：", normalizedError);
        setError(normalizedError);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReplaySource();

    return () => {
      active = false;
    };
  }, [
    conversationId,
    getChatEventsBatch,
    getConversationMessages,
    reloadGeneration,
  ]);

  return {
    source,
    loading,
    loadProgress,
    error,
    reload,
  };
}
