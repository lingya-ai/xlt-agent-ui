import { AiChatEventTypeEnum, ToolCallStatusEnum } from "../hooks/use-chat/schema";
import type { AssistantChatMessage } from "../hooks/use-chat/types";
import type {
  AssistantMessageRenderItem,
  AssistantStandaloneEvent,
  AssistantThinkEvent,
} from "./message-disclosure-policy";
import { orderToolEvents } from "./tool-event-state";
import {
  buildToolSegmentProjection,
  getAssistantSourceRef,
  type AssistantSourceRef,
  type ToolPresentation,
} from "./tool-presentation-projection";
import {
  summarizeProcessActivity,
  type ProcessActivitySummary,
} from "./process-activity-summary";

/** 模式无关的助手结构，不把普通过程从数据中删除。 */
export enum TurnItemKind {
  ProcessGroup = "process-group",
  Reply = "reply",
  Standalone = "standalone",
}

export enum ProcessMemberKind {
  Reasoning = "reasoning",
  Tool = "tool",
}

export type ProcessMember =
  | {
      kind: ProcessMemberKind.Reasoning;
      key: string;
      source: AssistantSourceRef;
      events: AssistantThinkEvent[];
      isStreaming: boolean;
    }
  | {
      kind: ProcessMemberKind.Tool;
      key: string;
      source: AssistantSourceRef;
      tool: ToolPresentation;
    };

export type UnifiedTurnItem =
  | {
      kind: TurnItemKind.ProcessGroup;
      key: string;
      members: ProcessMember[];
      summary: ProcessActivitySummary;
    }
  | {
      kind: TurnItemKind.Reply;
      key: string;
      events: AssistantMessageRenderItem["events"];
      important: boolean;
      isStreaming: boolean;
    }
  | {
      kind: TurnItemKind.Standalone;
      key: string;
      event: AssistantStandaloneEvent;
    };

export interface UnifiedTurnProjection {
  items: UnifiedTurnItem[];
  lastNonEmptyReplyKey?: string;
  hasOrdinaryProcess: boolean;
  observedToolCalls: number;
}

/** 仅尚待回答或审批的交互穿透组折叠，工具结果统一留在过程组内。 */
export function isProtectedTool(tool: ToolPresentation): boolean {
  const { derived } = tool;
  const awaitingAnswer =
    derived.awaitingInput !== undefined &&
    derived.askUserSelectedOptions === undefined &&
    (derived.state === ToolCallStatusEnum.Pending ||
      derived.state === ToolCallStatusEnum.Running ||
      derived.state === ToolCallStatusEnum.AwaitingApproval);
  return (
    awaitingAnswer ||
    (derived.planApproval !== undefined &&
      derived.state === ToolCallStatusEnum.AwaitingApproval)
  );
}

/** 单轮一次归并工具实体，生命周期只更新首次出现的展示位置。 */
export function buildUnifiedAssistantTurn(
  assistant: AssistantChatMessage[],
  loading: boolean,
  isImportantMessage: (item: AssistantMessageRenderItem) => boolean,
): UnifiedTurnProjection {
  const ordered = orderToolEvents(assistant);
  const lastVisibleIndex = ordered.reduce(
    (last, event, index) =>
      event.type === AiChatEventTypeEnum.Start ||
      event.type === AiChatEventTypeEnum.UserQuery
        ? last
        : index,
    -1,
  );
  const tools = buildToolSegmentProjection(ordered).tools;
  const toolsById = new Map(tools.map((tool) => [tool.toolId, tool]));
  const emittedTools = new Set<string>();
  const items: UnifiedTurnItem[] = [];
  let members: ProcessMember[] = [];
  let textEvents: AssistantMessageRenderItem["events"] = [];
  let thinkEvents: AssistantThinkEvent[] = [];
  let blockSource: AssistantSourceRef | undefined;
  let blockLastIndex = -1;

  const flushThink = () => {
    if (thinkEvents.length === 0 || !blockSource) return;
    members.push({
      kind: ProcessMemberKind.Reasoning,
      key: `think:${blockSource.eventKey}`,
      source: blockSource,
      events: thinkEvents,
      isStreaming: loading && blockLastIndex === lastVisibleIndex,
    });
    thinkEvents = [];
  };
  const flushGroup = () => {
    if (members.length === 0) return;
    const first = members[0];
    if (!first) return;
    items.push({
      kind: TurnItemKind.ProcessGroup,
      key: `process:${first.key}`,
      members,
      summary: summarizeProcessActivity(members),
    });
    members = [];
  };
  const flushText = () => {
    if (textEvents.length === 0 || !blockSource) return;
    const block: AssistantMessageRenderItem = {
      key: `message:${blockSource.eventKey}`,
      source: blockSource,
      events: textEvents,
      isStreaming: loading && blockLastIndex === lastVisibleIndex,
    };
    items.push({
      kind: TurnItemKind.Reply,
      key: block.key,
      events: textEvents,
      important: isImportantMessage(block),
      isStreaming: block.isStreaming,
    });
    textEvents = [];
  };

  ordered.forEach((event, index) => {
    // 协议诊断不构成可见边界，保留在 rawEvents 中即可。
    if (
      event.type === AiChatEventTypeEnum.Start ||
      event.type === AiChatEventTypeEnum.UserQuery
    )
      return;
    const source = getAssistantSourceRef(event, index);
    if ('rawJson' in event) {
      flushThink(); flushText(); flushGroup();
      items.push({kind: TurnItemKind.Standalone, key: 'unknown:' + source.eventKey, event});
      return;
    }
    if (event.type === AiChatEventTypeEnum.Think) {
      flushText();
      if (thinkEvents.length === 0) blockSource = source;
      thinkEvents.push(event);
      blockLastIndex = index;
      return;
    }
    if (event.type === AiChatEventTypeEnum.Message) {
      flushThink();
      flushGroup();
      if (textEvents.length === 0) blockSource = source;
      textEvents.push(event);
      blockLastIndex = index;
      return;
    }
    flushThink();
    flushText();
    const toolId =
      event.type === AiChatEventTypeEnum.ToolExecution
        ? event.toolId
        : event.type === AiChatEventTypeEnum.ToolExecutionSubAgentCall ||
            event.type === AiChatEventTypeEnum.ToolExecutionAwaitingUserInput
          ? event.toolCallId
          : undefined;
    if (toolId !== undefined) {
      if (!emittedTools.has(toolId)) {
        const tool = toolsById.get(toolId);
        if (tool) {
          members.push({
            kind: ProcessMemberKind.Tool,
            key: tool.key,
            source: tool.source,
            tool,
          });
          emittedTools.add(toolId);
        }
      }
      return;
    }
    flushGroup();
    items.push({
      kind: TurnItemKind.Standalone,
      key: `event:${source.eventKey}`,
      event: event as AssistantStandaloneEvent,
    });
  });
  flushThink();
  flushText();
  flushGroup();
  let lastNonEmptyReplyKey: string | undefined;
  for (const item of items) {
    if (
      item.kind === TurnItemKind.Reply &&
      item.events.some((event) => event.message.trim())
    )
      lastNonEmptyReplyKey = item.key;
  }
  return {
    items,
    lastNonEmptyReplyKey,
    observedToolCalls: tools.length,
    hasOrdinaryProcess: items.some((item) =>
      item.kind === TurnItemKind.ProcessGroup
        ? item.members.some(
            (member) =>
              member.kind === ProcessMemberKind.Reasoning ||
              !isProtectedTool(member.tool),
          )
        : item.kind === TurnItemKind.Reply &&
          item.events.some((event) => event.message.trim()) &&
          !item.important &&
          item.key !== lastNonEmptyReplyKey,
    ),
  };
}
