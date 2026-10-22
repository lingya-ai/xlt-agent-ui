import {type ToolCallStatusEnum} from "../hooks/use-chat/schema";

export type ToolState = ToolCallStatusEnum;

/**
 * 对话状态枚举
 * - submitted: 已提交
 * - streaming: 流式输出中
 * - ready: 就绪
 * - error: 错误
 */
export enum ChatStatusEnum {
  SUBMITTED = 'submitted',
  STREAMING = 'streaming',
  READY = 'ready',
  ERROR = 'error'
}

/** 合法的 JSON 值类型（null、基本类型、对象、数组） */
export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
/** JSON 对象，键为字符串，值为 JSONValue 或 undefined */
export type JSONObject = {
  [key: string]: JSONValue | undefined;
};
/** JSON 数组 */
export type JSONArray = JSONValue[];

/** 提供方元数据，键为提供方标识，值为 JSON 对象 */
export type ProviderMetadata = Record<string, JSONObject>;

/**
 * 文件类 UI 部件（用于多模态消息中的文件展示）
 */
export type FileUIPart = {
  type: 'file';
  /**
   * 文件的 IANA 媒体类型
   * @see https://www.iana.org/assignments/media-types/media-types.xhtml
   */
  mediaType: string;
  /** 可选的文件名 */
  filename?: string;
  /**
   * 文件 URL，可以是托管文件地址或 Data URL
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
   */
  url: string;
  /** 提供方元数据 */
  providerMetadata?: ProviderMetadata;
};

/**
 * 来源文档类 UI 部件（用于引用/来源展示）
 */
export type SourceDocumentUIPart = {
  type: 'source-document';
  /** 来源文档 ID */
  sourceId: string;
  /** 媒体类型 */
  mediaType: string;
  /** 文档标题 */
  title: string;
  /** 可选的文件名 */
  filename?: string;
  /** 提供方元数据 */
  providerMetadata?: ProviderMetadata;
};

/**
 * 单个工具类型定义（输入/输出泛型）
 */
export type UITool = {
  input: unknown;
  output: unknown | undefined;
};

/** 工具集合，键为工具名，值为 UITool */
export type UITools = Record<string, UITool>;

/**
 * 从对象类型中取出指定键对应的值类型
 * @template ObjectType 对象类型
 * @template ValueType 键名，默认为对象所有键的联合
 */
export type ValueOf<ObjectType, ValueType extends keyof ObjectType = keyof ObjectType> = ObjectType[ValueType];

/**
 * 工具调用展示形态（与 hook schema ToolCall/ToolResponse 及 DynamicToolUIPart 兼容）
 * @template TInput 工具输入类型
 * @template TOutput 工具输出类型
 */
export interface ToolInvocationLike<TInput = unknown, TOutput = unknown | undefined> {
  /** 工具调用展示状态 */
  state: ToolState;
  /** 工具调用 ID */
  toolCallId?: string;
  /** 工具输入 */
  input?: TInput;
  /** 工具输出 */
  output?: TOutput;
  /** 错误信息（如 output-error 状态） */
  errorText?: string;
  /** 审批信息（approval-requested / approval-responded / output-available 等状态时可选） */
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
  };
  /** 提供方元数据 */
  callProviderMetadata?: ProviderMetadata;
}

/**
 * 工具调用 UI 部件类型
 * 根据工具名生成 `tool-${NAME}` 类型并与 ToolInvocationLike 合并
 * @template TOOLS 工具集合类型，默认为 UITools
 */
export type ToolUIPart<TOOLS extends UITools = UITools> = ValueOf<{
  [NAME in keyof TOOLS & string]: {
  type: `tool-${NAME}`;
} & ToolInvocationLike<TOOLS[NAME]["input"], TOOLS[NAME]["output"]>;
}>;


/**
 * 生成的文件（用于 UI 展示或下载）
 */
export interface GeneratedFile {
  /** 文件的 base64 编码字符串 */
  readonly base64: string;
  /** 文件的 Uint8Array 形式 */
  readonly uint8Array: Uint8Array;
  /**
   * 文件的 IANA 媒体类型
   * @see https://www.iana.org/assignments/media-types/media-types.xhtml
   */
  readonly mediaType: string;
}

/** UI 消息中 data 部件所允许的数据类型映射，键为类型名，值为对应数据结构 */
type UIDataTypes = Record<string, unknown>;

/**
 * 消息的文本部件
 */
export type TextUIPart = {
  type: 'text';
  /** 文本内容 */
  text: string;
  /** 文本部件状态：流式输出中 | 已完成 */
  state?: 'streaming' | 'done';
  /** 提供方元数据 */
  providerMetadata?: ProviderMetadata;
};

/**
 * 消息的推理过程部件（思考链展示）
 */
export type ReasoningUIPart = {
  type: 'reasoning';
  /** 推理文本内容 */
  text: string;
  /** 推理部件状态：流式输出中 | 已完成 */
  state?: 'streaming' | 'done';
  /** 提供方元数据 */
  providerMetadata?: ProviderMetadata;
};

/**
 * 动态工具调用 UI 部件
 * 根据 state 区分：输入流式、输入就绪、待审批、已审批、输出就绪、输出错误、输出被拒绝
 */
export type DynamicToolUIPart = {
  type: 'dynamic-tool';
  /** 被调用的工具名称 */
  toolName: string;
  /** 工具调用 ID */
  toolCallId: string;
  /** 可选标题 */
  title?: string;
  /** 是否由提供方执行 */
  providerExecuted?: boolean;
} & ({
  state: 'input-streaming';
  input: unknown | undefined;
  output?: never;
  errorText?: never;
  callProviderMetadata?: ProviderMetadata;
  approval?: never;
} | {
  state: 'input-available';
  input: unknown;
  output?: never;
  errorText?: never;
  callProviderMetadata?: ProviderMetadata;
  approval?: never;
} | {
  state: 'approval-requested';
  input: unknown;
  output?: never;
  errorText?: never;
  callProviderMetadata?: ProviderMetadata;
  approval: {
    id: string;
    approved?: never;
    reason?: never;
  };
} | {
  state: 'approval-responded';
  input: unknown;
  output?: never;
  errorText?: never;
  callProviderMetadata?: ProviderMetadata;
  approval: {
    id: string;
    approved: boolean;
    reason?: string;
  };
} | {
  state: 'output-available';
  input: unknown;
  output: unknown;
  errorText?: never;
  callProviderMetadata?: ProviderMetadata;
  preliminary?: boolean;
  approval?: {
    id: string;
    approved: true;
    reason?: string;
  };
} | {
  state: 'output-error';
  input: unknown;
  output?: never;
  errorText: string;
  callProviderMetadata?: ProviderMetadata;
  approval?: {
    id: string;
    approved: true;
    reason?: string;
  };
} | {
  state: 'output-denied';
  input: unknown;
  output?: never;
  errorText?: never;
  callProviderMetadata?: ProviderMetadata;
  approval: {
    id: string;
    approved: false;
    reason?: string;
  };
});

/**
 * 消息的来源 URL 部件（引用链接）
 */
export type SourceUrlUIPart = {
  type: 'source-url';
  /** 来源 ID */
  sourceId: string;
  /** 来源 URL */
  url: string;
  /** 可选标题 */
  title?: string;
  /** 提供方元数据 */
  providerMetadata?: ProviderMetadata;
};

/**
 * 数据类 UI 部件
 * 根据 DATA_TYPES 生成 `data-${NAME}` 类型，携带对应 data 结构
 * @template DATA_TYPES 数据类型映射，继承 UIDataTypes
 */
export type DataUIPart<DATA_TYPES extends UIDataTypes> = ValueOf<{
  [NAME in keyof DATA_TYPES & string]: {
    type: `data-${NAME}`;
    id?: string;
    data: DATA_TYPES[NAME];
  };
}>;

/**
 * 消息的步骤边界部件（标记步骤开始）
 */
export type StepStartUIPart = {
  type: 'step-start';
};

/** UI 消息部件的联合类型：文本、推理、工具、动态工具、来源 URL、来源文档、文件、数据、步骤开始 */
export type UIMessagePart<DATA_TYPES extends UIDataTypes, TOOLS extends UITools> =
  TextUIPart
  | ReasoningUIPart
  | ToolUIPart<TOOLS>
  | DynamicToolUIPart
  | SourceUrlUIPart
  | SourceDocumentUIPart
  | FileUIPart
  | DataUIPart<DATA_TYPES>
  | StepStartUIPart;

/**
 * UI 消息
 * 用于客户端展示以及前端与 API 路由之间的消息结构。
 * 注意：与 chatList 渲染相关的 Message 角色请使用 hooks 的 ChatItemMessageRole，不以本 role 为数据源。
 * @template METADATA 消息元数据类型
 * @template DATA_PARTS 消息 data 部件数据类型映射
 * @template TOOLS 工具集合类型
 */
export interface UIMessage<METADATA = unknown, DATA_PARTS extends UIDataTypes = UIDataTypes, TOOLS extends UITools = UITools> {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色：system | user | assistant（Message 组件的 from 请使用 ChatItemMessageRole） */
  role: 'system' | 'user' | 'assistant';
  /** 消息元数据 */
  metadata?: METADATA;
  /**
   * 消息部件列表，用于在 UI 中渲染
   * - 尽量避免 system 消息（应在服务端设置 system prompt），可包含文本部件
   * - user 消息可包含文本部件和文件部件
   * - assistant 消息可包含文本、推理、工具调用和文件部件
   */
  parts: Array<UIMessagePart<DATA_PARTS, TOOLS>>;
}


/**
 * Represents the number of tokens used in a prompt and completion.
 */
export type LanguageModelUsage = {
  /**
   * The total number of input (prompt) tokens used.
   */
  inputTokens: number | undefined;
  /**
   * Detailed information about the input tokens.
   */
  inputTokenDetails: {
    /**
     * The number of non-cached input (prompt) tokens used.
     */
    noCacheTokens: number | undefined;
    /**
     * The number of cached input (prompt) tokens read.
     */
    cacheReadTokens: number | undefined;
    /**
     * The number of cached input (prompt) tokens written.
     */
    cacheWriteTokens: number | undefined;
  };
  /**
   * The number of total output (completion) tokens used.
   */
  outputTokens: number | undefined;
  /**
   * Detailed information about the output tokens.
   */
  outputTokenDetails: {
    /**
     * The number of text tokens used.
     */
    textTokens: number | undefined;
    /**
     * The number of reasoning tokens used.
     */
    reasoningTokens: number | undefined;
  };
  /**
   * The total number of tokens used.
   */
  totalTokens: number | undefined;
  /**
   * @deprecated Use outputTokenDetails.reasoningTokens instead.
   */
  reasoningTokens?: number | undefined;
  /**
   * @deprecated Use inputTokenDetails.cacheReadTokens instead.
   */
  cachedInputTokens?: number | undefined;
  /**
   * Raw usage information from the provider.
   *
   * This is the usage information in the shape that the provider returns.
   * It can include additional information that is not part of the standard usage information.
   */
  raw?: JSONObject;
};
