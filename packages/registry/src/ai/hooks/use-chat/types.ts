import type {AiChatEvent} from './schema';
import type {AiChatInput, ConversationUserMessage, ConversationMessage} from '@lingya-ai/agents-sdk/browser';
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";

import type { ChatStreamTransport } from "./chat-stream-transport";

/**
 * 变量类型
 */
export enum VariableTypeEnum {
  /**
   * 字符串类型
   */
  String = "String",

  /**
   * 整数类型
   */
  Int = "Int",

  /**
   * 小数类型
   */
  Double = "Double",

  /**
   * 布尔值类型
   */
  Boolean = "Boolean",
}

/**
 * 输入值
 */
export type Inputs = Record<string, string | number | object>;

/**
 * 定义的提示词变量
 */
export type PromptVariable = {
  // 唯一键
  key: string;
  // 显示名称
  name: string;
  // 变量类型
  type: VariableTypeEnum;
  // 默认值
  default?: string | number;
  // 是否启用
  enabled?: boolean;
};

/** 尚未提交的 UI 消息允许缺少服务端生成的元数据 */
export type UserChatMessage = Pick<ConversationUserMessage, 'text' | 'attachments'> & Partial<Pick<ConversationUserMessage, 'executionType'>>;
export type AssistantChatMessage = AiChatEvent;

/**
 * 消息角色（由 ChatItem 结构推导：仅有 user 与 assistant）
 */
export type ChatItemMessageRole = "user" | "assistant";

/** SSE 断线恢复期间的用户可感知状态。 */
export type ChatStreamRecoveryState = "reconnecting" | "rebuilding";

export type ChatItem = {
  executionType?: string;
  parentMessageId?: string | null;
  /** 服务端权威统计；缺失时不可将本地估算伪装为最终值。 */
  processingSteps?: number;
  totalToolCalls?: number;
  executionTimeMillis?: number;
  /** 真实 End 后等待服务端终态及合法统计；补全前不展示缓存中的最终计数。 */
  messageStatsPending?: boolean;

  /**
   * 消息id
   */
  id: string;

  /**
   * 响应未结束时值为 true，反之 false
   */
  loading: boolean;

  /**
   * 消息事件内容是否已加载（false 表示仅含元数据占位）
   */
  loaded: boolean;

  /**
   * 对话开始时间戳（毫秒），用于进行中时长展示。
   */
  startedAt?: number;

  /**
   * 用户消息内容
   */
  user?: UserChatMessage | undefined;

  /**
   * ai回答内容
   */
  assistant: AssistantChatMessage[];

  /**
   * 消息状态（历史消息从后端获取，流式消息为 undefined）
   */
  status?: ConversationMessage["status"];

  /** SSE 断线恢复状态；仅在重新订阅和重建渲染期间存在。 */
  streamRecoveryState?: ChatStreamRecoveryState;

  /** 渲染代次；重放事件流前递增，以重置消息内部的局部渲染状态。 */
  renderVersion?: number;
};

export type SendCallback = {
  /** 提交被接受后通知使用方，排队消息也会触发。 */
  onConversationSubmitted?: (
    conversationId: string,
    messageId: string,
    conversationGroupId?: number,
  ) => Promise<void> | void;
  // 在对话开始时
  onConversationStart?: (
    conversationId: string,
    messageId: string,
  ) => Promise<void> | void;
  // 消费每次的数据事件
  onConsumeEvent?: (
    conversationId: string,
    messageId: string,
    event: AiChatEvent,
  ) => Promise<void> | void;
  // 在对话完成时
  onConversationComplete?: (
    hasError: boolean,
    conversationId: string,
    messageId: string,
    errorMessage?: string,
    interrupted?: boolean,
  ) => Promise<void> | void;
};

/** 输入区编辑中的 SDK 请求体；发送时补上 query。 */
export type UserChatQuery = Partial<AiChatInput>;

export type UseChatOptions = {
  /** 暂停读取和订阅，不中断服务器正在执行的任务。 */
  readEnabled?: boolean;

  /**
   * http 客户端
   */
  httpClient: AgentsClient;

  /**
   * 对话id
   */
  conversationId?: string;

  /** 固定聊天回复传输协议；未提供时读取浏览器本地偏好。 */
  streamTransport?: ChatStreamTransport;

  /**
   * 提示词变量配置
   */
  promptVariablesConfig?: {
    inputs: Inputs;
    promptVariables: PromptVariable[];
  };
};
