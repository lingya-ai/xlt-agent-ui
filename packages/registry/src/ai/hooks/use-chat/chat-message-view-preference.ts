"use client";

import { useEffect, useRef, useState } from "react";
import { useMemoizedFn } from "ahooks";
import { createUseStorageState } from "ahooks/es/createUseStorageState";
import { z } from "zod";

export const CHAT_MESSAGE_VIEW_STORAGE_KEY =
  "xiaolingtong:ai-chat-message-view";

export enum ChatMessageViewMode {
  Compact = "compact",
  Full = "full",
}

// 保留既有公开字符串联合类型的可赋值性，校验仍统一使用枚举。
export type ChatMessageViewModeValue = `${ChatMessageViewMode}`;
export const chatMessageViewModeSchema = z.nativeEnum(ChatMessageViewMode);

/** 非法、缺失或过期的偏好统一降级到重点视图。 */
export function parseStoredChatMessageViewMode(
  value: unknown,
): ChatMessageViewModeValue {
  const result = chatMessageViewModeSchema.safeParse(value);
  return result.success ? result.data : ChatMessageViewMode.Compact;
}

/**
 * 仅默认非受控聊天参与共享偏好；首屏不访问存储，挂载后恢复。
 * 使用 ahooks 的存储订阅同步同页和跨标签页变化，写入失败时保留当前实例内存值。
 */
export function useChatMessageViewPreference(enabled = true) {
  const accessStorageRef = useRef(false);
  const failedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error>();
  const [memoryMode, setMemoryMode] = useState<ChatMessageViewModeValue>();
  const handleStorageError = useMemoizedFn((cause: unknown) => {
    if (failedRef.current) return;
    failedRef.current = true;
    const nextError =
      cause instanceof Error ? cause : new Error("消息视图偏好保存失败");
    // ahooks 的 getter 可能在渲染期失败，延迟通知避免更新渲染中的组件。
    queueMicrotask(() => {
      if (failedRef.current) setError(nextError);
    });
  });
  // useLocalStorageState 会在首帧读存储；使用同一底层工厂，给 getter 加挂载与独立模式门禁。
  const getStorage = useMemoizedFn(() =>
    accessStorageRef.current && enabled ? window.localStorage : undefined,
  );
  const [usePreferenceStorage] = useState(() =>
    createUseStorageState(getStorage),
  );
  const [storedMode, setStoredMode] =
    usePreferenceStorage<ChatMessageViewModeValue>(
      ready && enabled
        ? CHAT_MESSAGE_VIEW_STORAGE_KEY
        : `${CHAT_MESSAGE_VIEW_STORAGE_KEY}:inactive`,
      {
        defaultValue: ChatMessageViewMode.Compact,
        listenStorageChange: ready && enabled,
        serializer: (value) => value,
        deserializer: parseStoredChatMessageViewMode,
        onError: handleStorageError,
      },
    );

  useEffect(() => {
    accessStorageRef.current = true;
    setReady(true);
    return () => {
      accessStorageRef.current = false;
    };
  }, []);

  const setMode = useMemoizedFn(
    (nextMode: ChatMessageViewModeValue): boolean => {
      if (!enabled) return false;
      setMemoryMode(nextMode);
      try {
        // 先持久化，避免 ahooks 将与旧状态相同的失败重试短路。
        window.localStorage.setItem(CHAT_MESSAGE_VIEW_STORAGE_KEY, nextMode);
        setStoredMode(nextMode);
        const saved =
          window.localStorage.getItem(CHAT_MESSAGE_VIEW_STORAGE_KEY) ===
          nextMode;
        if (saved) {
          failedRef.current = false;
          setError(undefined);
          setMemoryMode(undefined);
        } else {
          handleStorageError(new Error("消息视图偏好保存失败"));
        }
        return saved;
      } catch (cause) {
        handleStorageError(cause);
        return false;
      }
    },
  );
  const clearError = useMemoizedFn(() => setError(undefined));

  return {
    mode:
      enabled && ready
        ? (memoryMode ?? storedMode ?? ChatMessageViewMode.Compact)
        : ChatMessageViewMode.Compact,
    setMode,
    error: enabled ? error : undefined,
    clearError,
  };
}
