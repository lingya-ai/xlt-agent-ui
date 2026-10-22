"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import type { AccessPolicy } from "../../integration/access";

import type { AiChatToolExecutionEvent } from "../hooks/use-chat/schema";
import type { AiChatReadiness } from "../hooks/use-chat/use-chat-readiness";
import type { ChatStreamTransport } from "../hooks/use-chat/chat-stream-transport";

import type { ChatItem } from "../hooks/use-chat/types";
import type {
  UserInputAnswerOutput,
  UserInputAnswerParams,
} from "../hooks/use-chat/use-hitl";

export type { AiChatReadiness } from "../hooks/use-chat/use-chat-readiness";

/** 工具事件所属的聊天消息上下文。 */
export interface AiChatToolCallContext {
  conversationId: string;
  messageId: string;
}

/**
 * AI 聊天工具回调 Context
 * 提供工具事件中需要由使用方注入的回调函数和配置
 */
/** 应用注入具体权限，共享聊天只按操作类别消费策略。 */
export interface AiChatAccessPolicies {
  read?: AccessPolicy;
  submit?: AccessPolicy;
  execute?: AccessPolicy;
  conversationWrite?: AccessPolicy;
  attachmentWrite?: AccessPolicy;
}

export interface AiChatContextOptions {
  /** 未提供策略时沿用现有业务和只读规则。 */
  accessPolicies?: AiChatAccessPolicies;

  /**
   * http 客户端
   */
  httpClient: AgentsClient;
  /** Provider 生命周期信号，身份切换与卸载时中止。 */
  signal?: AbortSignal;

  /** 固定聊天回复传输协议；未提供时读取浏览器本地偏好。 */
  streamTransport?: ChatStreamTransport;

  /**
   * 只读场景预置的会话 ID，用于历史消息中的制品预览、下载等资源请求。
   */
  initialConversationId?: string;

  /** 后端已接受消息，包括排队消息；不代表已经开始执行。 */
  onConversationSubmitted?: (
    conversationId: string,
    messageId: string,
    conversationGroupId?: number,
  ) => void | Promise<void>;

  /** 当前实例已成功加载并提交渲染的终态消息。 */
  onReadinessChange?: (readiness: AiChatReadiness) => void;

  /** 本地提交的消息开始执行时触发，排队消息在提升后触发。 */
  onConversationStart?: (
    conversationId: string,
    messageId: string,
    info: { firstUserMessage: string; isFirstMessage: boolean },
  ) => Promise<void> | void;

  /**
   * 对话完成回调（SSE 流结束后触发）
   */
  onConversationComplete?: (
    hasError: boolean,
    conversationId: string,
    messageId: string,
    errorMessage?: string,
  ) => Promise<void> | void;

  /**
   * 发送消息前回调（可用于自动保存等操作）
   */
  onBeforeSubmit?: (
    conversationId: string | undefined,
  ) =>
    | Promise<{ conversationId?: string; conversationGroupId?: number } | void>
    | { conversationId?: string; conversationGroupId?: number }
    | void;

  /** 目标模式创建目标前回调；可用于校验执行权限并先保存会话能力。 */
  onBeforeGoalCreate?: (
    conversationId: string | undefined,
  ) =>
    | Promise<{ conversationId?: string; conversationGroupId?: number } | void>
    | { conversationId?: string; conversationGroupId?: number }
    | void;

  /**
   * 用户回答工具提问的回调
   */
  onUserInputAnswer?: (
    params: UserInputAnswerParams,
  ) => UserInputAnswerOutput | Promise<UserInputAnswerOutput>;

  /**
   * 计划审批回调
   */
  onPlanApproval?: (params: {
    approved: boolean;
    feedback?: string;
    conversationId: string;
    messageId: string;
  }) => void;

  /**
   * conversationId 变更回调（用于消息导航等外部组件同步状态）
   */
  onConversationIdChange?: (conversationId: string | undefined) => void;

  /** 宿主预先创建聊天会话后同步路由与页面状态。 */
  onConversationCreated?: (conversationId: string) => void;

  /**
   * chatList 变更回调（状态提升，用于消息导航等外部组件）
   */
  onChatListChange?: (chatList: ChatItem[]) => void;

  /**
   * 工具调用事件回调
   * 每条 ToolExecution SSE 事件触发一次，外部可按 event.status 区分工具状态
   * （Pending/Running/Success/Error/AwaitingApproval/Interrupted 等）做细粒度响应
   * 例如：技能资源被工具创建/修改/删除后按需刷新列表
   */
  onToolCall?: (
    event: AiChatToolExecutionEvent,
    context: AiChatToolCallContext,
  ) => void;
}

export interface AiChatContextValue extends AiChatContextOptions {
  /** 当前聊天实例的对话 ID。新对话尚未发送消息时为空。 */
  conversationId?: string;
  /** 当前新草稿的目标分组；首次消息提交后由聊天组件完成归组。 */
  pendingConversationGroupId: number | null;
  /** 设置或清除当前新草稿的目标分组。 */
  setPendingConversationGroupId: (groupId: number | null) => void;
  /** 清除目标分组；传入 ID 时仅在目标仍一致时清除。 */
  clearPendingConversationGroupId: (groupId?: number) => void;
}

export type AiChatContextProviderProps = PropsWithChildren<{
  value: AiChatContextOptions;
}>;

const AiChatContext = createContext<AiChatContextValue | null>(null);

/** Context Provider，由 AgentsChat 使用方注入，并统一维护当前对话 ID。 */
export function AiChatContextProvider({
  children,
  value,
}: AiChatContextProviderProps) {
  const {
    initialConversationId,
    onConversationIdChange,
    onBeforeSubmit,
    ...rest
  } = value;
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );
  const [pendingConversationGroupId, setPendingGroupId] = useState<
    number | null
  >(null);

  useEffect(() => {
    setConversationId(initialConversationId);
  }, [initialConversationId]);

  const handleConversationIdChange = useCallback(
    (conversationId: string | undefined) => {
      setConversationId(conversationId);
      onConversationIdChange?.(conversationId);
    },
    [setConversationId, onConversationIdChange],
  );

  const setPendingConversationGroupId = useCallback(
    (groupId: number | null) => setPendingGroupId(groupId),
    [],
  );

  const clearPendingConversationGroupId = useCallback((groupId?: number) => {
    setPendingGroupId((current) =>
      current !== null && (groupId === undefined || current === groupId)
        ? null
        : current,
    );
  }, []);

  const handleBeforeSubmit = useCallback(
    async (conversationId: string | undefined) => {
      const prepared = await onBeforeSubmit?.(conversationId);
      const groupId =
        prepared?.conversationGroupId ?? pendingConversationGroupId;
      if (!prepared && groupId === null) return;
      return {
        ...(prepared ?? {}),
        ...(groupId === null ? {} : { conversationGroupId: groupId }),
      };
    },
    [onBeforeSubmit, pendingConversationGroupId],
  );

  return (
    <AiChatContext.Provider
      value={{
        ...rest,
        conversationId,
        onBeforeSubmit: handleBeforeSubmit,
        pendingConversationGroupId,
        setPendingConversationGroupId,
        clearPendingConversationGroupId,
        onConversationIdChange: handleConversationIdChange,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChatContext(): AiChatContextValue {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error(
      `useAiChatContext must be used inside a AiChatContextProvider`,
    );
  }
  return context;
}

/** 获取当前 Provider 的取消信号；独立 Hook 可在 Provider 外使用 SDK */
export function useAiChatRequestSignal(client: AgentsClient): AbortSignal | undefined {
  const context = useContext(AiChatContext);
  return context?.httpClient === client ? context.signal : undefined;
}
