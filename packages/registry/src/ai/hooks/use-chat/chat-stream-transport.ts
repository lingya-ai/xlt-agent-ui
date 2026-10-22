"use client";

import { useCallback, useState } from "react";
import { useLocalStorageState, useMemoizedFn } from "ahooks";
import { z } from "zod";

export const CHAT_STREAM_TRANSPORT_STORAGE_KEY =
  "xiaolingtong:ai-chat-stream-transport";

export const chatStreamTransportSchema = z.enum(["sse", "ws"]);

export type ChatStreamTransport = z.infer<typeof chatStreamTransportSchema>;

export interface ChatStreamTransportPreference {
  transport: ChatStreamTransport;
  setTransport: (transport: ChatStreamTransport) => boolean;
  error: Error | undefined;
  clearError: () => void;
}

/** 将本地存储中的未知内容收窄为聊天流协议，非法值统一回退 SSE。 */
export function parseStoredChatStreamTransport(
  value: string | null | undefined,
): ChatStreamTransport {
  const result = chatStreamTransportSchema.safeParse(value);
  return result.success ? result.data : "sse";
}

function normalizeStorageError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("聊天流协议偏好保存失败");
}

/**
 * 读取并更新当前站点共享的聊天流协议偏好。
 *
 * ahooks 会通过 storage 事件和同页自定义事件同步所有 Hook 实例。
 */
export function useChatStreamTransportPreference(): ChatStreamTransportPreference {
  const [error, setError] = useState<Error>();
  const handleStorageError = useMemoizedFn((cause: unknown) => {
    const nextError = normalizeStorageError(cause);
    queueMicrotask(() => setError(nextError));
  });
  const [transport, setStoredTransport] =
    useLocalStorageState<ChatStreamTransport>(
      CHAT_STREAM_TRANSPORT_STORAGE_KEY,
      {
        defaultValue: "sse",
        listenStorageChange: true,
        serializer: (value) => value,
        deserializer: parseStoredChatStreamTransport,
        onError: handleStorageError,
      },
    );

  const setTransport = useCallback(
    (nextTransport: ChatStreamTransport): boolean => {
      setError(undefined);
      setStoredTransport(nextTransport);

      try {
        return (
          window.localStorage.getItem(CHAT_STREAM_TRANSPORT_STORAGE_KEY) ===
          nextTransport
        );
      } catch (cause) {
        handleStorageError(cause);
        return false;
      }
    },
    [handleStorageError, setStoredTransport],
  );

  const clearError = useCallback(() => setError(undefined), []);

  return {
    transport: transport ?? "sse",
    setTransport,
    error,
    clearError,
  };
}
