/** UI 直接采用 SDK 协议类型；本文件只保留展示状态常量。 */
export type {
  ChatModelSpec as ModelConfig,
  MediaAttachment,
  ArtifactInfo as Artifacts,
  AiChatSubmission as AiChatBaseResponse,
  AiChatUserQueryBriefEvent as AiChatUserQueryEvent,
  AiChatStartBriefEvent as AiChatStartEvent,
  AiChatCompressorContextStartBriefEvent as AiChatCompressorContextStartEvent,
  AiChatCompressorContextEndBriefEvent as AiChatCompressorContextEndEvent,
  AiChatCompactorWarningBriefEvent as AiChatCompactorWarningEvent,
  AiChatManualInterruptBriefEvent as AiChatManualInterruptEvent,
  AiChatErrorBriefEvent as AiChatErrorEvent,
  AiChatMessageBriefEvent as AiChatMessageEvent,
  AiChatThinkBriefEvent as AiChatThinkEvent,
  AiChatEndBriefEvent as AiChatEndEvent,
  ReturnedReference as KnowledgeCitation,
  SqlQueryExtensionContent as SqlQueryContent,
  SqlResultColumnSchema as SqlResultColumn,
  ChartNumberFormat,
  ChartSeries,
  ChartSpec as ChartSpecV1,
  ChartQualitySummary,
  ChartTimeContext,
  SqlQueryResultExtensionContent as SqlQueryResultContent,
  SqlChartResultExtensionContent as SqlChartResultContent,
  ChartColumnData as ExcelSqlChartColumn,
  SqlChartDataset as ExcelSqlChartDataset,
  SqlQueryResultRow,
  SqlQueryResultPage,
  VariableBinding as MathVariableBinding,
  MathFormulaExtensionContent as MathFormulaContent,
  MathResultExtensionContent as MathResultContent,
  JsRunScriptExtensionContent as JsRunScriptContent,
  JsRunScriptResultExtensionContent as JsRunScriptResultContent,
  ImageGenerationExtensionContent as ImageGenerationContent,
  PlanApprovalExtensionContent as PlanApprovalContent,
  AskUserQuestionExtensionContent as AskUserQuestionContent,
  SkillResourceExtensionContent as SkillResourceContent,
  TaskSummary,
  TaskProgressExtensionContent as TaskProgressContent,
  AiChatToolExecutionBriefEvent as AiChatToolExecutionEvent,
  AiChatSubAgentCallBriefEvent as AiChatToolExecutionSubAgentCallEvent,
  AskUserQuestionOption,
  AiChatAwaitingInputBriefEvent as AiChatToolExecutionAwaitingUserInputEvent,
  AiChatBriefEvent as AiChatEvent,
  ToolExtension as ToolExtensionInfo
} from "@lingya-ai/agents-sdk/browser";
import type {ChartSpec, ChartNumberFormat, ChartSeries, SqlResultColumnSchema, ToolExtension, UnknownToolExtension} from "@lingya-ai/agents-sdk/browser";
export type ChartType = ChartSpec['type'];
export type ChartCategoryType = ChartSpec['categoryType'];
export type SqlChartOrientation = ChartSpec['orientation'];
export type ChartRenderType = ChartSeries['renderType'];
export type SqlChartAxis = ChartSeries['axis'];
export type ChartNumberFormatType = ChartNumberFormat['type'];
export type ChartValueScale = ChartNumberFormat['valueScale'];
export type SqlChartDataZoom = ChartSpec['dataZoom'];
export type ChartNullPolicy = ChartSpec['nullPolicy'];
export type SqlColumnType = SqlResultColumnSchema['type'];
export type KnownToolExtensionInfo = Exclude<ToolExtension, UnknownToolExtension>;
export enum AiChatEventTypeEnum {

  /** 用户查询 */
  UserQuery = "user-query",

  /** 压缩上下文开始 */
  CompressorContextStart = "compressor-context-start",

  /** 压缩上下文结束 */
  CompressorContextEnd = "compressor-context-end",

  /** 压缩器警告 */
  CompactorWarning = "compactor-warning",

  /** 手动中断 */
  ManualInterrupt = "manual-interrupt",

  /** 执行错误 */
  Error = "error",

  /** 开始 */
  Start = "start",

  /** 思考 */
  Think = "think",

  /** 消息 */
  Message = "message",

  /** 工具执行（统一事件，通过 status 区分 Running/Completed/Error/Blocked/Skipped） */
  ToolExecution = "tool-execution",

  /** 工具执行子智能体调用（仅当工具内部调用子智能体时发布） */
  ToolExecutionSubAgentCall = "tool-execution-sub-agent-call",

  /** 工具等待用户输入 */
  ToolExecutionAwaitingUserInput = "tool-execution-awaiting-user-input",

  /** 结束 */
  End = "end"
}

export enum ChatMessageType {
  SYSTEM = "SYSTEM",
  ASSISTANT = "ASSISTANT",
  USER = "USER",
  TOOL = "TOOL"
}

export enum StepExecStatusEnum {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

export enum ToolCallStatusEnum {

  /** 待处理 */
  Pending = "Pending",

  /** 运行中 */
  Running = "Running",

  /** 等待批准 */
  AwaitingApproval = "AwaitingApproval",

  /** 已拒绝 */
  ApprovalDenied = "ApprovalDenied",

  /** 已回应 */
  ApprovalResponded = "ApprovalResponded",

  /** 已成功 */
  Success = "Success",

  /** 无结果 */
  NoResult = "NoResult",

  /** 被阻止 */
  Blocked = "Blocked",

  /** 被跳过 */
  Skipped = "Skipped",

  /** 执行错误 */
  Error = "Error",

  /** 执行超时 */
  Timeout = "Timeout",

  /** 已中断 */
  Interrupted = "Interrupted",
}

export enum ToolAction {

  /** 默认 */
  DEFAULT = "DEFAULT",

  /** 搜索 */
  SEARCH = "SEARCH",

  /** 读取 */
  READ = "READ",

  /** 写入 */
  WRITE = "WRITE",

  /** 更新 */
  UPDATE = "UPDATE",

  /** 删除 */
  DELETE = "DELETE",

  /** 执行 */
  EXECUTE = "EXECUTE",

  /** 交互 */
  INTERACT = "INTERACT",

  /** 委托 */
  DELEGATE = "DELEGATE",
}

export enum AgentMessageDispatchDisposition {
  STARTED = "STARTED",
  QUEUED = "QUEUED",
}

export enum CompactorWarningLevelEnum {
  /** 降级通知：compactCoefficient 正在自动调低 */
  DEGRADE = "DEGRADE",
  /** 锁死通知：compactCoefficient 已达最小值，自动压缩已暂停 */
  LOCKED = "LOCKED",
}

export enum SearchSourceTypeEnum {
  VECTOR = "VECTOR",
  FULLTEXT = "FULLTEXT",
  HYBRID = "HYBRID",
  GRAPH = "GRAPH",
  TRAJECTORY = "TRAJECTORY",
  DIRECT = "DIRECT",
}

export enum SubchunkTypeEnum {
  KEYWORD = "KEYWORD",
  TRANSLATION = "TRANSLATION",
  QUESTION = "QUESTION",
  CUSTOM = "CUSTOM",
}

export enum KnowledgeCitationType {
  CHUNK = "CHUNK",
  ENTITY = "ENTITY",
  COMMUNITY = "COMMUNITY",
  CLAIM = "CLAIM",
}

export const TOOL_EXTENSION_CATEGORY = {
  /** 知识库引用 */
  KNOWLEDGE_CITATION: "knowledgeCitation",
  /** 文生图结果 */
  IMAGE_GENERATION: "imageGeneration",
  /** 计划审批 */
  PLAN_APPROVAL: "planApproval",
  /** 询问用户问题 */
  ASK_USER_QUESTION: "askUserQuestion",
  /** 技能资源变动（创建/更新/替换） */
  SKILL_RESOURCE: "skillResource",
  /** 任务进度（task-write 整表替换成功后推送） */
  TASK_PROGRESS: "taskProgress",
  /** SQL 查询语句 */
  SQL_QUERY: "sqlQuery",
  /** SQL 查询结果 */
  SQL_QUERY_RESULT: "sqlQueryResult",
  /** SQL 图表结果 */
  SQL_CHART_RESULT: "sqlChartResult",
  /** 数学公式 */
  MATH_FORMULA: "mathFormula",
  /** 数学计算结果 */
  MATH_RESULT: "mathResult",
  /** JavaScript 脚本执行 */
  JS_RUN_SCRIPT: "jsRunScript",
  /** JavaScript 脚本执行结果 */
  JS_RUN_SCRIPT_RESULT: "jsRunScriptResult",
} as const;

export enum SkillResourceOperationTypeEnum {
  /** 新建资源（create_skill_resource） */
  CREATE = "CREATE",
  /** 修改既有资源（update_skill_resource / replace_skill_resource） */
  UPDATE = "UPDATE",
  /** 删除资源（delete_skill_resource） */
  DELETE = "DELETE",
}

export enum TASK_STATUS {
  /** 待处理 */
  PENDING = "PENDING",
  /** 进行中 */
  IN_PROGRESS = "IN_PROGRESS",
  /** 已完成 */
  COMPLETED = "COMPLETED",
}

export enum UnknownToolExtensionCategory {
  UNKNOWN = "unknown",
}

/** 仅用于选择已有专用渲染器，不修改 SDK 扩展对象 */
export function isKnownToolExtensionInfo(extension: ToolExtension): extension is KnownToolExtensionInfo {
 return ['planApproval','askUserQuestion','imageGeneration','sqlQuery','sqlQueryResult','sqlChartResult','mathFormula','mathResult','jsRunScript','jsRunScriptResult','skillResource','taskProgress'].includes(extension.category);
}
