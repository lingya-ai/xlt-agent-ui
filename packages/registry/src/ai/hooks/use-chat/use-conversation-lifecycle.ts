"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentMessages } from "../../../i18n/runtime";
import { toast } from "sonner";
import {useAiChatRequestSignal} from "../../agents/context";
import {ApiError} from "@lingya-ai/agents-sdk/browser";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import {
  notifyConversationStatusChanged,
  subscribeConversationLifecycle,
} from "./conversation-lifecycle";
import {
  ConversationStatus,
  useConversationOperations,
} from "./use-conversation-operations";



/** 从摘要获取权威状态；状态尚未确认时不开放执行入口。 */
export function useConversationLifecycle({
  httpClient,
  conversationId,
  enabled,
  allowMissing = false,
}: {
  httpClient: AgentsClient;
  conversationId?: string;
  enabled: boolean;
  allowMissing?: boolean;
}) {
  const signal=useAiChatRequestSignal(httpClient);
  const t = useAgentMessages("ai-conversation-lifecycle");
  const [snapshot, setSnapshot] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const generation = useRef(0);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!enabled || !conversationId) return;
    try {
      const summary = await httpClient.conversations.getConversationSummary(conversationId, {signal});
      if (version === generation.current) {
        setSnapshot({ id: conversationId, status: summary.status });
        setFailed(false);
      }
    } catch (error) {
      if (version !== generation.current) return;
      if (
        allowMissing &&
        error instanceof ApiError &&
        error.status === 404
      ) {
        setSnapshot({ id: conversationId, status: ConversationStatus.ACTIVE });
      } else {
        setFailed(true);
        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 410)
        )
          setSnapshot({
            id: conversationId,
            status: ConversationStatus.DELETED,
          });
      }
      // 刷新失败保留已经确认的状态，初次读取失败继续关闭执行入口。
    }
  }, [conversationId, enabled, httpClient, allowMissing,signal]);
  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeConversationLifecycle(() => void refresh());
    return () => {
      generation.current += 1;
      unsubscribe();
    };
  }, [refresh]);
  const { updateStatus } = useConversationOperations({ httpClient });
  const restoreRequest = useApiRequest(
    async () => {
      if (!conversationId) return;
      await updateStatus(conversationId, { status: ConversationStatus.ACTIVE });
      setSnapshot({ id: conversationId, status: ConversationStatus.ACTIVE });
      toast.success(t.restoreSuccess.value);
      notifyConversationStatusChanged(
        conversationId,
        ConversationStatus.ACTIVE,
      );
    },
    { manual: true },
  );
  const status =
    snapshot && snapshot.id === conversationId ? snapshot.status : undefined;
  return {
    unavailable: enabled && failed && status !== ConversationStatus.ARCHIVED,
    archived: status === ConversationStatus.ARCHIVED,
    blocked:
      enabled &&
      Boolean(conversationId) &&
      status !== ConversationStatus.ACTIVE,
    restore: restoreRequest.runAsync,
    restoring: restoreRequest.loading,
    refresh,
  };
}
