import { consumeChatEvent } from "./consume-chat-event";
import { resolveConversationExecutionType } from "./conversation-execution-type";
import {
  ConversationMessageStatus,
  type ConversationMessageOutput,
} from "./conversation-message";
import {
  type AiChatEvent,
  AiChatEventTypeEnum,
  type AiChatToolExecutionEvent,
  type TaskProgressContent,
  TOOL_EXTENSION_CATEGORY,
} from "./schema";
import type { ChatItem } from "./types";
import {pickMessageStatistics, type MessageStatistics} from "./message-metadata";

export const REPLAY_SPEED_OPTIONS = [0.25, 0.5, 0.75, 1] as const;
export type ReplaySpeed = (typeof REPLAY_SPEED_OPTIONS)[number];

/** 新的 1× 对应原来的 2×，因此展示倍速需要乘以 2 后参与延迟计算。 */
const REPLAY_SPEED_NORMALIZATION = 2;

export type ConversationReplayMessage = MessageStatistics & {
  executionType?: string;
  parentMessageId?: string | null;
  id: string;
  startedAt: number;
  user: ChatItem["user"];
  finalStatus: ConversationMessageOutput["status"];
  events: AiChatEvent[];
};

export type ConversationReplayStep =
  | { kind: "message"; messageIndex: number }
  | { kind: "event"; messageIndex: number; eventIndex: number };

export type ConversationReplaySource = {
  messages: ConversationReplayMessage[];
  steps: ConversationReplayStep[];
};

/** 公开 SDK 不提供 sequence，历史回放保持接口的事件顺序 */
export function orderReplayEvents(events: AiChatEvent[]): AiChatEvent[] { return [...events]; }

const MIN_TEXT_STEP_LENGTH = 24;

/**
 * 合并连续的极小文本分片，避免长回复因事件数量过多而回放数分钟。
 *
 * 只合并相邻且同类型的 Message/Think，不跨越工具、进度或终态事件。
 */
export function coalesceReplayTextEvents(events: AiChatEvent[]): AiChatEvent[] {
  const result: AiChatEvent[] = [];

  events.forEach((event) => {
    const previous = result[result.length - 1];
    const isTextEvent =
      event.type === AiChatEventTypeEnum.Message ||
      event.type === AiChatEventTypeEnum.Think;
    const canMerge =
      isTextEvent &&
      previous && !("rawJson" in previous) &&
      (previous.type === AiChatEventTypeEnum.Message || previous.type === AiChatEventTypeEnum.Think) &&
      previous.type === event.type &&
      previous.message.length < MIN_TEXT_STEP_LENGTH;

    if (canMerge && !("rawJson" in event) && (event.type === AiChatEventTypeEnum.Message || event.type === AiChatEventTypeEnum.Think)) {
      result[result.length - 1] = {
        ...event,
        message: previous.message + event.message,
      };
      return;
    }

    result.push(event);
  });

  return result;
}

/**
 * 将消息元数据和批量历史事件组装为不可变回放源。
 */
export function buildConversationReplaySource(
  messageMetadata: ConversationMessageOutput[],
  eventsByMessageId: ReadonlyMap<string, AiChatEvent[]>,
): ConversationReplaySource {
  const messages = messageMetadata.map<ConversationReplayMessage>(
    (message) => ({
      ...pickMessageStatistics(message),
      id: message.messageId,
      startedAt: new Date(message.createdTime).getTime(),
      user: message.userMessage,
      executionType: resolveConversationExecutionType(message.userMessage, message.executionType),
      parentMessageId: message.parentMessageId,
      finalStatus: message.status,
      events: orderReplayEvents(eventsByMessageId.get(message.messageId) ?? []),
    }),
  );
  const steps: ConversationReplayStep[] = [];

  messages.forEach((message, messageIndex) => {
    steps.push({ kind: "message", messageIndex });
    message.events.forEach((_event, eventIndex) => {
      steps.push({ kind: "event", messageIndex, eventIndex });
    });
  });

  return { messages, steps };
}

function createInitialReplayItem(message: ConversationReplayMessage): ChatItem {
  const hasEvents = message.events.length > 0;

  return {
    ...pickMessageStatistics(message),
    id: message.id,
    loading: hasEvents,
    loaded: true,
    startedAt: message.startedAt,
    user: message.user,
    executionType: resolveConversationExecutionType(message.user, message.executionType),
    parentMessageId: message.parentMessageId,
    assistant: [],
    status: hasEvents ? ConversationMessageStatus.PENDING : message.finalStatus,
  };
}

/**
 * 向当前可见消息列表推进一个步骤。
 */
export function applyConversationReplayStep(
  chatList: ChatItem[],
  source: ConversationReplaySource,
  step: ConversationReplayStep,
): ChatItem[] {
  const message = source.messages[step.messageIndex];
  if (!message) return chatList;

  if (step.kind === "message") {
    if (chatList.some((item) => item.id === message.id)) return chatList;
    return [...chatList, createInitialReplayItem(message)];
  }

  const event = message.events[step.eventIndex];
  if (!event) return chatList;

  const existingIndex = chatList.findIndex((item) => item.id === message.id);
  const currentItem =
    existingIndex >= 0
      ? chatList[existingIndex]
      : createInitialReplayItem(message);
  if (!currentItem) return chatList;

  let nextItem = consumeChatEvent(currentItem, event);
  const isLastEvent = step.eventIndex === message.events.length - 1;
  if (isLastEvent && nextItem.loading) {
    nextItem = {
      ...nextItem,
      loading: false,
      status: message.finalStatus,
    };
  }

  if (existingIndex < 0) {
    return [...chatList, nextItem];
  }

  const nextList = [...chatList];
  nextList[existingIndex] = nextItem;
  return nextList;
}

/** 将回放源投影到指定步骤，主要用于“查看全部”和纯函数验证。 */
export function projectConversationReplay(
  source: ConversationReplaySource,
  stepCount = source.steps.length,
): ChatItem[] {
  const limit = Math.max(0, Math.min(stepCount, source.steps.length));
  let chatList: ChatItem[] = [];

  for (let index = 0; index < limit; index += 1) {
    const step = source.steps[index];
    if (step) {
      chatList = applyConversationReplayStep(chatList, source, step);
    }
  }

  return chatList;
}

/** 根据下一步骤类型计算产品化播放间隔。 */
export function getConversationReplayDelay(
  source: ConversationReplaySource,
  step: ConversationReplayStep,
  speed: ReplaySpeed,
): number {
  const effectiveSpeed = speed * REPLAY_SPEED_NORMALIZATION;

  if (step.kind === "message") {
    return Math.round(420 / effectiveSpeed);
  }

  const event = source.messages[step.messageIndex]?.events[step.eventIndex];
  let baseDelay = 300;

  switch (event?.type) {
    case AiChatEventTypeEnum.Message:
    case AiChatEventTypeEnum.Think:
      baseDelay = 80;
      break;
    case AiChatEventTypeEnum.ToolExecution:
    case AiChatEventTypeEnum.ToolExecutionSubAgentCall:
    case AiChatEventTypeEnum.ToolExecutionAwaitingUserInput:
      baseDelay = 420;
      break;
    case AiChatEventTypeEnum.End:
    case AiChatEventTypeEnum.ManualInterrupt:
    case AiChatEventTypeEnum.Error:
      baseDelay = 560;
      break;
    case AiChatEventTypeEnum.CompressorContextStart:
    case AiChatEventTypeEnum.CompressorContextEnd:
      baseDelay = 320;
      break;
    default:
      baseDelay = 260;
  }

  return Math.max(40, Math.round(baseDelay / effectiveSpeed));
}

/**
 * 从最新轮次的事件中提取任务进度快照。
 *
 * 任务计划属于当前轮次：后端在用户发来新消息时作废旧计划，task-write 只写当前轮次。
 * 因此只看最后一条消息的事件，不跨消息向前回溯上一轮的计划；新一轮还没有产出 taskProgress
 * 事件时返回 undefined，面板随之收起。
 */
export function findLatestTaskProgress(
  chatList: ChatItem[],
): TaskProgressContent | undefined {
  const currentRound = chatList[chatList.length - 1]?.assistant;
  if (!currentRound || currentRound.length === 0) return undefined;

  return findLatestTaskProgressInEvents(currentRound);
}

/** 在单条消息的事件序列中取最后一次任务进度快照。 */
function findLatestTaskProgressInEvents(
  events: ChatItem["assistant"],
): TaskProgressContent | undefined {
  for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const event = events[eventIndex];
    if (event?.type !== AiChatEventTypeEnum.ToolExecution) continue;

    const toolEvent = event as AiChatToolExecutionEvent;
    if (
      toolEvent.extension?.category === TOOL_EXTENSION_CATEGORY.TASK_PROGRESS
    ) {
      return toolEvent.extension.content as TaskProgressContent;
    }
  }

  return undefined;
}
