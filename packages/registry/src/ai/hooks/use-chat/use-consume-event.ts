"use client";

import { useCallback } from "react";

import { consumeChatEvent } from "./consume-chat-event";
import type { AiChatEvent } from "./schema";
import type { ChatItem } from "./types";

export type ConsumeEventCallback = (
  chatItem: ChatItem,
  data: AiChatEvent,
) => ChatItem;

/**
 * 消费单条 SSE 事件回调 Hook。
 *
 * 实际数据归并委托给纯函数，确保实时聊天和历史回放使用同一套语义。
 */
export function useConsumeEvent(): ConsumeEventCallback {
  return useCallback(
    (chatItem: ChatItem, data: AiChatEvent) => consumeChatEvent(chatItem, data),
    [],
  );
}
