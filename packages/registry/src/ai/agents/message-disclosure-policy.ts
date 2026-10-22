import { AiChatEventTypeEnum } from "../hooks/use-chat/schema";
import type { AssistantChatMessage } from "../hooks/use-chat/types";
import {
  buildUnifiedAssistantTurn,
  type UnifiedTurnProjection,
} from "./unified-assistant-turn";
import type { AssistantSourceRef } from "./tool-presentation-projection";

/** 消息展示模式：compact 按重要性压缩，full 展示完整事件。 */
export type AgentsChatMessageViewMode = "compact" | "full";

/** 消息展示配置。未传入时默认使用 compact。 */
export type AgentsChatMessageViewOptions = {
  /** 受控展示模式；传入后由调用方负责更新。 */
  mode?: AgentsChatMessageViewMode;
  /** 非受控展示模式的初始值，默认使用 compact。 */
  defaultMode?: AgentsChatMessageViewMode;
  /** 是否允许用户在重点视图与全部视图之间切换。 */
  switchable?: boolean;
  /** 用户切换展示模式时触发。 */
  onModeChange?: (mode: AgentsChatMessageViewMode) => void;
};

import type {AiChatMessageBriefEvent as AssistantMessageEvent, AiChatThinkBriefEvent as AssistantThinkEvent, AiChatToolExecutionBriefEvent, AiChatSubAgentCallBriefEvent, AiChatAwaitingInputBriefEvent} from '@lingya-ai/agents-sdk/browser';
export type {AiChatMessageBriefEvent as AssistantMessageEvent, AiChatThinkBriefEvent as AssistantThinkEvent} from '@lingya-ai/agents-sdk/browser';
type AssistantToolEvent = AiChatToolExecutionBriefEvent | AiChatSubAgentCallBriefEvent | AiChatAwaitingInputBriefEvent;

export type AssistantStandaloneEvent = Exclude<
  AssistantChatMessage,
  AssistantMessageEvent | AssistantThinkEvent | AssistantToolEvent
>;

/** 压缩模式下工作指示器的语义状态。 */
export type AssistantWorkingState =
  | "thinking"
  | "executing-tools"
  | "compressing-context";

/** 参与重要性判断的助手文本块，不包含任何旧分组或工具摘要结构。 */
export type AssistantMessageRenderItem = {
  key: string;
  events: AssistantMessageEvent[];
  isStreaming: boolean;
  source: AssistantSourceRef;
};

/** 同一份结构供重点、全部及历史消息使用，披露策略由渲染层决定。 */
export type AssistantTurnProjection = UnifiedTurnProjection & {
  rawEvents: readonly AssistantChatMessage[];
  workingState?: AssistantWorkingState;
};

const MARKDOWN_ATX_HEADING_PATTERN = /^ {0,3}#{1,6}[ \t]+\S/u;
const MARKDOWN_SETEXT_HEADING_PATTERN = /^ {0,3}(?:=+|-+)[ \t]*$/u;

/** 判断当前配置是否允许用户主动切换消息展示模式。 */
export function isMessageViewSwitchEnabled(
  options?: AgentsChatMessageViewOptions,
  defaultSwitchable = false,
): boolean {
  return Boolean(
    (options?.switchable ?? defaultSwitchable) &&
      (options?.mode === undefined || options.onModeChange !== undefined),
  );
}

/**
 * 判断助手文本消息是否属于重要信息。
 *
 * 以消息首部的加粗标题作为规范信号，正文可紧跟标题或换行，并兼容历史消息首部的 Markdown 标题。
 * 正文内部的标题和行内加粗不参与判断，避免因内容排版而展开整段过程说明。
 */
export function isImportantAssistantMessage(
  item: AssistantMessageRenderItem,
): boolean {
  const content = getAssistantMessageText(item)
    .replace(/^\uFEFF/u, "")
    .trim();

  if (!content) return false;

  return (
    hasLeadingBoldTitle(content) ||
    hasLeadingMarkdownHeadingCompatibility(content)
  );
}

/** 判断文本是否以非空加粗标题开头，正文可与标题同行或换行。 */
function hasLeadingBoldTitle(content: string): boolean {
  if (!content.startsWith("**")) return false;

  const closingIndex = content.indexOf("**", 2);
  if (closingIndex <= 2) return false;

  const title = content.slice(2, closingIndex).trim();
  return Boolean(title && !title.includes("\n") && !title.includes("\r"));
}

/** 仅兼容消息开头的 ATX/Setext 标题，避免正文标题被误判为披露信号。 */
function hasLeadingMarkdownHeadingCompatibility(content: string): boolean {
  const [firstLine = "", secondLine] = content.split(/\r?\n|\r/u, 2);

  if (MARKDOWN_ATX_HEADING_PATTERN.test(firstLine)) return true;

  return (
    firstLine.trim().length > 0 &&
    secondLine !== undefined &&
    MARKDOWN_SETEXT_HEADING_PATTERN.test(secondLine)
  );
}

/** 统一投影保留全部事件；文本重要性和工作状态只作为前端展示信息。 */
export function buildAssistantTurnProjection(
  assistant: AssistantChatMessage[],
  loading: boolean,
): AssistantTurnProjection {
  return {
    ...buildUnifiedAssistantTurn(
      assistant,
      loading,
      isImportantAssistantMessage,
    ),
    rawEvents: assistant,
    workingState: deriveAssistantWorkingState(assistant, loading),
  };
}

/** 根据当前事件流派生压缩模式下的工作提示。 */
export function deriveAssistantWorkingState(
  assistant: readonly AssistantChatMessage[],
  loading: boolean,
): AssistantWorkingState | undefined {
  if (!loading) return undefined;

  let compressionDepth = 0;
  let lastProgress: AssistantWorkingState = "thinking";

  for (const event of assistant) {
    switch (event.type) {
      case AiChatEventTypeEnum.CompressorContextStart:
        compressionDepth += 1;
        break;
      case AiChatEventTypeEnum.CompressorContextEnd:
        compressionDepth = Math.max(0, compressionDepth - 1);
        if (compressionDepth === 0) lastProgress = "thinking";
        break;
      case AiChatEventTypeEnum.ToolExecution:
      case AiChatEventTypeEnum.ToolExecutionSubAgentCall:
      case AiChatEventTypeEnum.ToolExecutionAwaitingUserInput:
        lastProgress = "executing-tools";
        break;
      case AiChatEventTypeEnum.Think:
      case AiChatEventTypeEnum.Message:
        lastProgress = "thinking";
        break;
    }
  }

  return compressionDepth > 0 ? "compressing-context" : lastProgress;
}

function getAssistantMessageText(item: AssistantMessageRenderItem): string {
  return item.events.map((event) => event.message).join("");
}
