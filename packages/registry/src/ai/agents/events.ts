"use client"

import {createContext, useContext, useMemo} from "react";
import {useEventEmitter} from "ahooks";
import type {EventEmitter} from "ahooks/lib/useEventEmitter";

import {type ChatItem} from "../hooks/use-chat/types";

import type {AiChatToolExecutionEvent, Artifacts} from "../hooks/use-chat/schema";
import type {WorkspaceNonFileArtifact} from "../hooks/use-chat/workspace-non-file-artifact-schema";

/** 对话开始事件 */
export type ConversationStartEvent = { conversationId: string, messageId: string }

/** 对话完成事件 */
export type ConversationCompleteEvent = {
  hasError: boolean,
  conversationId: string,
  messageId: string,
  errorMessage?: string
}

/** 聊天结束事件返回的本轮工作区制品，用于列表对账和刷新当前命中的预览。 */
export type TerminalWorkspaceArtifactsEvent = {
  terminalType: "end",
  conversationId: string,
  messageId: string,
  artifacts: Artifacts[],
  nonFileArtifacts: WorkspaceNonFileArtifact[]
}

/** 用户回答工具提问事件 */
export type UserInputAnswerEvent = import("@lingya-ai/agents-sdk/browser").UserInputAnswerInput;

/** 计划审批事件 */
export type PlanApprovalEvent = import("@lingya-ai/agents-sdk/browser").PlanApprovalInput;

/** conversationId 变更事件 */
export type ConversationIdChangeEvent = { conversationId: string | undefined }

/** chatList 变更事件 */
export type ChatListChangeEvent = { chatList: ChatItem[] }

/** 按需加载消息事件请求（导航器点击未加载消息时触发） */
export type MessageLoadRequestEvent = { conversationId: string, messageId: string }

/** 加载更早消息请求 */
export type LoadOlderMessagesRequestEvent = { conversationId: string }

/** 工具调用事件（每条 ToolExecution SSE 事件触发一次） */
export type ToolCallEvent = { event: AiChatToolExecutionEvent }

/** 向当前聊天输入框插入文本。 */
export type ChatInputTextInsertEvent = { text: string }

/**
 * AI 聊天 Context 中支持的事件处理
 */
export interface AiChatContextEventOptions {

  /** 当前对话 ID */
  conversationId: string | undefined

  /** 对话开始回调（POST /chat 响应后触发） */
  conversationStartEvent: EventEmitter<ConversationStartEvent>

  /** 对话完成回调（SSE 流结束后触发） */
  conversationCompleteEvent: EventEmitter<ConversationCompleteEvent>

  /** 发送消息前回调（可用于自动保存等操作） */
  beforeSubmitEvent: EventEmitter<void>

  /** 终态事件中的本轮工作区制品 */
  terminalWorkspaceArtifactsEvent: EventEmitter<TerminalWorkspaceArtifactsEvent>

  /** 用户回答工具提问的回调 */
  userInputAnswerEvent: EventEmitter<UserInputAnswerEvent>

  /** 计划审批回调 */
  planApprovalEvent: EventEmitter<PlanApprovalEvent>

  /** conversationId 变更回调 */
  conversationIdChangeEvent: EventEmitter<ConversationIdChangeEvent>

  /** chatList 变更回调 */
  chatListChangeEvent: EventEmitter<ChatListChangeEvent>

  /** 按需加载消息事件请求（导航器点击未加载消息时触发） */
  messageLoadRequestEvent: EventEmitter<MessageLoadRequestEvent>

  /** 加载更早消息请求 */
  loadOlderMessagesRequestEvent: EventEmitter<LoadOlderMessagesRequestEvent>

  /** 工具调用事件（每条 ToolExecution SSE 事件触发） */
  toolCallEvent: EventEmitter<ToolCallEvent>

  /** 向当前聊天输入框插入文本。 */
  chatInputTextInsertEvent: EventEmitter<ChatInputTextInsertEvent>

}

/**
 * 事件值
 */
export function useAiChatContextEventValue(conversationId: string | undefined): AiChatContextEventOptions {
  const conversationStartEvent = useEventEmitter<ConversationStartEvent>();
  const conversationCompleteEvent = useEventEmitter<ConversationCompleteEvent>();
  const beforeSubmitEvent = useEventEmitter<void>();
  const terminalWorkspaceArtifactsEvent = useEventEmitter<TerminalWorkspaceArtifactsEvent>();
  const userInputAnswerEvent = useEventEmitter<UserInputAnswerEvent>();
  const planApprovalEvent = useEventEmitter<PlanApprovalEvent>();
  const conversationIdChangeEvent = useEventEmitter<ConversationIdChangeEvent>();
  const chatListChangeEvent = useEventEmitter<ChatListChangeEvent>();
  const messageLoadRequestEvent = useEventEmitter<MessageLoadRequestEvent>();
  const loadOlderMessagesRequestEvent = useEventEmitter<LoadOlderMessagesRequestEvent>();
  const toolCallEvent = useEventEmitter<ToolCallEvent>();
  const chatInputTextInsertEvent = useEventEmitter<ChatInputTextInsertEvent>();

  return useMemo(() => ({
    conversationId,
    conversationStartEvent,
    conversationCompleteEvent,
    beforeSubmitEvent,
    terminalWorkspaceArtifactsEvent,
    userInputAnswerEvent,
    planApprovalEvent,
    conversationIdChangeEvent,
    chatListChangeEvent,
    messageLoadRequestEvent,
    loadOlderMessagesRequestEvent,
    toolCallEvent,
    chatInputTextInsertEvent,
  }), [
    beforeSubmitEvent,
    chatInputTextInsertEvent,
    chatListChangeEvent,
    conversationCompleteEvent,
    conversationId,
    conversationIdChangeEvent,
    conversationStartEvent,
    loadOlderMessagesRequestEvent,
    messageLoadRequestEvent,
    planApprovalEvent,
    terminalWorkspaceArtifactsEvent,
    toolCallEvent,
    userInputAnswerEvent,
  ])
}

const AiChatContextEvent = createContext<AiChatContextEventOptions | null>(null)

/** Context Provider，由 AgentsChat 注入 */
export const AiChatContextEventProvider = AiChatContextEvent.Provider

/** 获取可选事件上下文，供可独立渲染的组件提供 fallback。 */
export function useOptionalAiChatContextEvent(): AiChatContextEventOptions | null {
  return useContext(AiChatContextEvent)
}

export function useAiChatContextEvent(): AiChatContextEventOptions {
  const context = useContext(AiChatContextEvent)
  if (!context) {
    throw new Error(`useAiChatContextEvent must be used inside a AiChatContextEventProvider`)
  }
  return context;
}
