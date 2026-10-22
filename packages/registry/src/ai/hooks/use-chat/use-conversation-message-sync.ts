"use client";
import type {ConversationMessageSync} from '@lingya-ai/agents-sdk/browser';


import { useEffect, useRef } from "react";
import { useDocumentVisibility, useLatest, useMemoizedFn } from "ahooks";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import {type ConversationMessageOutput} from "./conversation-message";

/** 按页追赶公开消息；只有合并成功后才推进游标。 */
export async function consumeMessageSync(
  initialCursor: string | null,
  read: (
    cursor: string | null,
  ) => Promise<ConversationMessageSync>,
  merge: (messages: ConversationMessageOutput[]) => Promise<void | false>,
  current: () => boolean,
  advance: (cursor: string | null) => void,
) {
  let cursor = initialCursor;
  while (current()) {
    const page = await read(cursor);
    if (!current()) return;
    const merged = await merge(page.messages);
    if (merged === false || !current()) return;
    if (page.hasMore && page.nextMessageId === cursor)
      throw new Error("公开消息同步游标无法推进");
    cursor = page.nextMessageId;
    advance(cursor);
    if (!page.hasMore) return;
  }
}

/** 发现后台目标轮与人工回应，并交给现有消息加载器建立实时流。 */
export function useConversationMessageSync({
  httpClient,
  conversationId,
  ready,
  initialCursorMessageId,
  fast,
  refreshKey,
  onSynchronize,
}: {
  httpClient: AgentsClient;
  conversationId?: string;
  ready: boolean;
  initialCursorMessageId?: string | null;
  fast: boolean;
  refreshKey: number;
  onSynchronize: (
    messages: ConversationMessageOutput[],
  ) => Promise<void | false>;
}) {
  const visibility = useDocumentVisibility();
  const latest = useLatest({
    conversationId,
    ready,
    visibility,
    onSynchronize,
  });
  const cursor = useRef<string | null>(null);
  const initialized = useRef(false);
  const generation = useRef(0);
  const flight = useRef<Promise<void> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const refresh = useMemoizedFn(async () => {
    if (!ready || !conversationId || visibility !== "visible") return;
    if (flight.current) return flight.current;
    if (!initialized.current) {
      cursor.current = initialCursorMessageId ?? null;
      initialized.current = true;
    }
    const captured = generation.current;
    const controller = new AbortController();
    abort.current = controller;
    const current = () =>
      captured === generation.current &&
      latest.current.ready &&
      latest.current.conversationId === conversationId &&
      latest.current.visibility === "visible" &&
      !controller.signal.aborted;
    const operation = consumeMessageSync(
      cursor.current,
      (afterMessageId) =>
        httpClient.messages.syncConversationMessages(conversationId, {...({ afterMessageId: afterMessageId ?? undefined, size: 50 }), signal: controller.signal}),
      (messages) => latest.current.onSynchronize(messages),
      current,
      (value) => {
        cursor.current = value;
      },
    );
    flight.current = operation;
    try {
      await operation;
    } finally {
      if (flight.current === operation) flight.current = null;
    }
  });
  const request = useApiRequest(refresh, {
    manual: true,
    pollingInterval: fast ? 3000 : 15000,
    pollingWhenHidden: false,
    pollingSilentLoading: true,
    disableErrorNotification: true,
  });
  const { run, cancel } = request;
  useEffect(() => {
    generation.current += 1;
    abort.current?.abort();
    flight.current = null;
    cursor.current = null;
    initialized.current = false;
    return () => {
      generation.current += 1;
      abort.current?.abort();
      cancel();
    };
  }, [httpClient, conversationId, cancel]);
  useEffect(() => {
    if (ready && conversationId && visibility === "visible") run();
    else {
      abort.current?.abort();
      cancel();
    }
    return cancel;
  }, [ready, conversationId, visibility, refreshKey, run, cancel]);
  return request;
}
