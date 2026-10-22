import {
  AiChatEventTypeEnum,
  TOOL_EXTENSION_CATEGORY,
  type SqlChartResultContent,
  type SqlQueryResultContent,
  ToolCallStatusEnum,
} from "../hooks/use-chat/schema";
import type { AssistantChatMessage } from "../hooks/use-chat/types";
import { deriveToolStates, type ToolDerivedState } from "./tool-event-state";

/** 投影项指向原始事件的稳定来源。 */
export type AssistantSourceRef = {
  eventType: AssistantChatMessage["type"];
  eventKey: string;
  sourceIndex: number;
  toolId?: string;
  messageId?: string;
};

/** Compact 主视图需要直接展示的重点工具结果。 */
export type AssistantKeyResult =
  | {
      kind: "generated-image";
      key: string;
      source: AssistantSourceRef;
      toolId: string;
      fileId: number;
    }
  | {
      kind: "sql-table";
      key: string;
      source: AssistantSourceRef;
      toolId: string;
      summary?: string;
      /** 供调用方保留原始上下文，界面不再渲染 SQL。 */
      sql?: string;
      result: SqlQueryResultContent;
    }
  | {
      kind: "sql-chart";
      key: string;
      source: AssistantSourceRef;
      toolId: string;
      summary?: string;
      /** 供调用方保留原始上下文，界面不再渲染 SQL。 */
      sql?: string;
      result: SqlChartResultContent;
    };

/** 工具中的交互和异常状态，用于重点渲染或工具摘要信息。 */
export type ToolAttention = {
  awaitingUserInput: boolean;
  awaitingPlanApproval: boolean;
  failed: boolean;
};

/** 单个工具的集中展示投影。 */
export type ToolPresentation = {
  key: string;
  toolId: string;
  toolName: string;
  /** 工具扩展是否允许使用特殊渲染；重点模式仍需确认已有可视结果，缺失表示历史数据。 */
  specialRender?: boolean;
  source: AssistantSourceRef;
  /** 同一 toolId 的全部事件，按展示顺序集中保留。 */
  events: AssistantChatMessage[];
  derived: ToolDerivedState;
  keyResults: AssistantKeyResult[];
  attention: ToolAttention;
};

/** 连续工具事件形成的展示投影。 */
export type ToolSegmentProjection = {
  key: string;
  events: AssistantChatMessage[];
  tools: ToolPresentation[];
  keyResults: AssistantKeyResult[];
  requiresAttention: boolean;
  hasPendingUserInput: boolean;
  hasPendingPlanApproval: boolean;
};

type IndexedEvent = {
  event: AssistantChatMessage;
  sourceIndex: number;
};

const FAILED_TOOL_STATES: ReadonlySet<string> = new Set<string>([
  ToolCallStatusEnum.ApprovalDenied,
  ToolCallStatusEnum.Blocked,
  ToolCallStatusEnum.Error,
  ToolCallStatusEnum.Timeout,
  ToolCallStatusEnum.Interrupted,
]);

/**
 * 将一个连续工具事件段集中派生为工具详情、关键结果和待处理状态。
 * 这里是工具状态的唯一识别入口，渲染组件不再重复调用 deriveToolStates()。
 */
export function buildToolSegmentProjection(
  events: AssistantChatMessage[],
  fallbackStartIndex = 0,
): ToolSegmentProjection {
  const indexedEvents = orderIndexedToolEvents(events, fallbackStartIndex);
  const stateMap = deriveToolStates(events);
  const toolSources = new Map<string, IndexedEvent>();
  const toolNames = new Map<string, string>();
  const toolEvents = new Map<string, AssistantChatMessage[]>();
  const specialRenderByToolId = new Map<string, boolean>();
  const imageSources = new Map<string, IndexedEvent>();
  const sqlTableSources = new Map<string, IndexedEvent>();
  const sqlChartSources = new Map<string, IndexedEvent>();

  for (const indexed of indexedEvents) {
    const { event } = indexed;
    const identity = getToolEventIdentity(event);
    if (!identity) continue;

    if (!toolSources.has(identity.toolId)) {
      toolSources.set(identity.toolId, indexed);
      toolNames.set(identity.toolId, identity.toolName);
    }
    const eventsForTool = toolEvents.get(identity.toolId) ?? [];
    eventsForTool.push(event);
    toolEvents.set(identity.toolId, eventsForTool);

    if ("rawJson" in event || event.type !== AiChatEventTypeEnum.ToolExecution) continue;

    if (event.extension?.specialRender != null) {
      const currentSpecialRender = specialRenderByToolId.get(event.toolId);
      specialRenderByToolId.set(
        event.toolId,
        currentSpecialRender === true || event.extension.specialRender,
      );
    }

    switch (event.extension?.category) {
      case TOOL_EXTENSION_CATEGORY.IMAGE_GENERATION:
        imageSources.set(event.toolId, indexed);
        break;
      case TOOL_EXTENSION_CATEGORY.SQL_QUERY_RESULT:
        sqlTableSources.set(event.toolId, indexed);
        sqlChartSources.delete(event.toolId);
        break;
      case TOOL_EXTENSION_CATEGORY.SQL_CHART_RESULT:
        sqlChartSources.set(event.toolId, indexed);
        sqlTableSources.delete(event.toolId);
        break;
    }
  }

  const tools: ToolPresentation[] = [];
  for (const [toolId, sourceEvent] of toolSources) {
    const derived = stateMap.get(toolId);
    if (!derived) continue;

    const source = getAssistantSourceRef(
      sourceEvent.event,
      sourceEvent.sourceIndex,
    );
    const keyResults = buildToolKeyResults({
      toolId,
      derived,
      imageSource: imageSources.get(toolId),
      sqlTableSource: sqlTableSources.get(toolId),
      sqlChartSource: sqlChartSources.get(toolId),
    });
    const attention: ToolAttention = {
      awaitingUserInput:
        derived.awaitingInput !== undefined &&
        derived.askUserSelectedOptions === undefined,
      awaitingPlanApproval:
        derived.planApproval !== undefined &&
        derived.state === ToolCallStatusEnum.AwaitingApproval,
      failed: FAILED_TOOL_STATES.has(derived.state),
    };

    tools.push({
      key: `tool:${toolId}:${source.eventKey}`,
      toolId,
      toolName: toolNames.get(toolId) ?? toolId,
      specialRender: specialRenderByToolId.get(toolId),
      source,
      events: toolEvents.get(toolId) ?? [],
      derived,
      keyResults,
      attention,
    });
  }

  const keyResults = tools
    .flatMap((tool) => tool.keyResults)
    .sort(compareSourceOrder);
  const firstSource = indexedEvents[0];
  const hasPendingUserInput = tools.some(
    (tool) => tool.attention.awaitingUserInput,
  );
  const hasPendingPlanApproval = tools.some(
    (tool) => tool.attention.awaitingPlanApproval,
  );

  return {
    key: `tool-segment:${getAssistantSourceRef(firstSource?.event, firstSource?.sourceIndex ?? fallbackStartIndex).eventKey}`,
    events,
    tools,
    keyResults,
    requiresAttention:
      hasPendingUserInput ||
      hasPendingPlanApproval ||
      tools.some((tool) => tool.attention.failed),
    hasPendingUserInput,
    hasPendingPlanApproval,
  };
}

/** 为任意助手事件生成稳定来源引用。 */
export function getAssistantSourceRef(
  event: AssistantChatMessage | undefined,
  sourceIndex: number,
): AssistantSourceRef {
  if (!event) {
    return {
      eventType: AiChatEventTypeEnum.Start,
      eventKey: `missing:${sourceIndex}`,
      sourceIndex,
    };
  }

  const toolId = getEventToolId(event);
  const messageId = "messageId" in event && typeof event.messageId === "string" ? event.messageId : undefined;
  const conversationId =
    "conversationId" in event && typeof event.conversationId === "string" ? event.conversationId : undefined;
  const stableOwner = toolId ?? messageId ?? conversationId ?? event.type;

  return {
    eventType: event.type,
    eventKey: `${stableOwner}:${sourceIndex}`,
    sourceIndex,
    toolId,
    messageId,
  };
}

function buildToolKeyResults({
  toolId,
  derived,
  imageSource,
  sqlTableSource,
  sqlChartSource,
}: {
  toolId: string;
  derived: ToolDerivedState;
  imageSource?: IndexedEvent;
  sqlTableSource?: IndexedEvent;
  sqlChartSource?: IndexedEvent;
}): AssistantKeyResult[] {
  const results: AssistantKeyResult[] = [];

  if (derived.imageFileId !== undefined && imageSource) {
    const source = getAssistantSourceRef(
      imageSource.event,
      imageSource.sourceIndex,
    );
    results.push({
      kind: "generated-image",
      key: `tool-result:image:${toolId}:${derived.imageFileId}`,
      source,
      toolId,
      fileId: derived.imageFileId,
    });
  }

  if (derived.sqlChartResult && sqlChartSource) {
    const source = getAssistantSourceRef(
      sqlChartSource.event,
      sqlChartSource.sourceIndex,
    );
    results.push({
      kind: "sql-chart",
      key: `tool-result:sql-chart:${toolId}:${derived.sqlChartResult.resultId}`,
      source,
      toolId,
      summary: derived.sqlResultSummary ?? derived.summary ?? undefined,
      sql: derived.sqlQuery,
      result: derived.sqlChartResult,
    });
  } else if (derived.sqlQueryResult && sqlTableSource) {
    const source = getAssistantSourceRef(
      sqlTableSource.event,
      sqlTableSource.sourceIndex,
    );
    results.push({
      kind: "sql-table",
      key: `tool-result:sql-table:${toolId}:${derived.sqlQueryResult.resultId}`,
      source,
      toolId,
      summary: derived.sqlResultSummary ?? derived.summary ?? undefined,
      sql: derived.sqlQuery,
      result: derived.sqlQueryResult,
    });
  }

  return results.sort(compareSourceOrder);
}

function orderIndexedToolEvents(
  events: AssistantChatMessage[],
  fallbackStartIndex: number,
): IndexedEvent[] {
  const indexed = events.map((event, index) => ({
    event,
    sourceIndex: fallbackStartIndex + index,
  }));
  return indexed;
}

function compareSourceOrder(
  left: AssistantKeyResult,
  right: AssistantKeyResult,
): number {
  return left.source.sourceIndex - right.source.sourceIndex;
}

function getToolEventIdentity(
  event: AssistantChatMessage,
): { toolId: string; toolName: string } | undefined {
  if ("rawJson" in event) return undefined;
  if (event.type === AiChatEventTypeEnum.ToolExecution) {
    return { toolId: event.toolId, toolName: event.toolName };
  }
  if (
    event.type === AiChatEventTypeEnum.ToolExecutionSubAgentCall ||
    event.type === AiChatEventTypeEnum.ToolExecutionAwaitingUserInput
  ) {
    return { toolId: event.toolCallId, toolName: event.toolName };
  }
  return undefined;
}

function getEventToolId(event: AssistantChatMessage): string | undefined {
  if ("rawJson" in event) return undefined;
  return getToolEventIdentity(event)?.toolId;
}
