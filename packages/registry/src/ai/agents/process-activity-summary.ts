import {
  AiChatEventTypeEnum,
  ToolAction,
  ToolCallStatusEnum,
} from "../hooks/use-chat/schema";
import {
  isProtectedTool,
  ProcessMemberKind,
  type ProcessMember,
} from "./unified-assistant-turn";

export enum ProcessActivityStatus {
  Running = "running",
  Settled = "settled",
  Attention = "attention",
}

export enum ProcessActivityKind {
  Idle = "idle",
  Tool = "tool",
  Reasoning = "reasoning",
  Text = "text",
}

/** 标题整体替换的快照；身份区分动作相同的不同工具。 */
export interface ProcessActivity {
  kind: ProcessActivityKind;
  key?: string;
  action?: string;
  preparing?: boolean;
  detail?: string;
}

export interface ProcessActivitySummary {
  /** 当前活动为空档时，通过 latestActivity 恢复该组最近一次真实活动。 */
  activity?: ProcessActivity;
  latestActivity?: ProcessActivity;
  categories: Array<{ action: string; count: number }>;
  observedToolCalls: number;
  activeAction?: string;
  preparing?: boolean;
  detail?: string;
  reasoningPreview?: string;
  /** 最近助手行或运行中思考段落的单行预览，工具摘要由 detail 独立提供。 */
  preview?: string;
  status: ProcessActivityStatus;
}

/** 仅提取最新非空行用于标题；完整文本与业务输出均保持原样。 */
export function getActivityPreview(text: string): string | undefined {
  const latestLine = text
    .split(/\r?\n/u)
    .reverse()
    .find((line) => line.trim())
    ?.trim()
    .replace(/\*\*/gu, "");
  if (!latestLine) return undefined;
  const codePoints = Array.from(latestLine);
  return codePoints.length > 120
    ? `${codePoints.slice(0, 120).join("")}…`
    : latestLine;
}

/** 只规范化已有业务文本，不读取工具参数或原始结果。 */
export function getToolActivityDetail(text: string): string | undefined {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (!normalized) return undefined;
  const codePoints = Array.from(normalized);
  return codePoints.length > 160
    ? `${codePoints.slice(0, 159).join("")}…`
    : normalized;
}

/** 最新思考段落压成一行，流式尾段尚未结束时也能预览。 */
export function getReasoningActivityPreview(text: string): string | undefined {
  const paragraph = text
    .split(/\r?\n[\t ]*\r?\n/u)
    .reverse()
    .find((value) => value.trim());
  return paragraph
    ? getToolActivityDetail(paragraph.replace(/\*\*/gu, ""))
    : undefined;
}

/** 类别保持首次出现顺序，不因流式计数变化反复重排。 */
export function summarizeProcessActivity(
  members: readonly ProcessMember[],
): ProcessActivitySummary {
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  let activeAction: string | undefined;
  let preparing: boolean | undefined;
  let activeSource: ProcessMember["source"] | undefined;
  let detail: string | undefined;
  let reasoningPreview: string | undefined;
  let running = false;
  let attention = false;
  let activity: ProcessActivity = { kind: ProcessActivityKind.Idle };
  let latestActivity: ProcessActivity | undefined;
  for (const member of members) {
    if (member.kind === ProcessMemberKind.Reasoning) {
      latestActivity = {
        kind: ProcessActivityKind.Reasoning,
        key: member.key,
        detail: getReasoningActivityPreview(
          member.events.map((event) => event.message).join(""),
        ),
      };
      if (member.isStreaming) activity = latestActivity;
      if (member.isStreaming)
        reasoningPreview =
          getReasoningActivityPreview(
            member.events.map((event) => event.message).join(""),
          ) ?? reasoningPreview;
      running ||= member.isStreaming;
      continue;
    }
    const { tool } = member;
    if (seen.has(tool.toolId)) continue;
    seen.add(tool.toolId);
    const action = tool.derived.action ?? ToolAction.DEFAULT;
    // 完成事件可能携带新的结果摘要；回放时仍恢复最后一个执行阶段的标题。
    let executionActivity: ProcessActivity | undefined;
    for (const event of tool.events) {
      if (
        "rawJson" in event || event.type !== AiChatEventTypeEnum.ToolExecution ||
        (event.status !== ToolCallStatusEnum.Pending &&
          event.status !== ToolCallStatusEnum.Running)
      )
        continue;
      executionActivity = {
        kind: ProcessActivityKind.Tool,
        key: member.key,
        action: event.action ?? executionActivity?.action ?? action,
        preparing: event.status === ToolCallStatusEnum.Pending,
        detail:
          getToolActivityDetail(event.summary ?? "") ??
          executionActivity?.detail,
      };
    }
    latestActivity = executionActivity ?? {
      kind: ProcessActivityKind.Tool,
      key: member.key,
      action,
      preparing: tool.derived.state === ToolCallStatusEnum.Pending,
      detail: getToolActivityDetail(tool.derived.summary ?? ""),
    };
    counts.set(action, (counts.get(action) ?? 0) + 1);
    attention ||= isProtectedTool(tool);
    if (
      tool.derived.state === ToolCallStatusEnum.Pending ||
      tool.derived.state === ToolCallStatusEnum.Running
    ) {
      running = true;
      const source = tool.source;
      // 身份与显示位置取首次调用来源，公开事件保持输入顺序。
      const latest =
        !activeSource ||
        source.sourceIndex >= activeSource.sourceIndex;
      if (latest) {
        activity = {
          kind: ProcessActivityKind.Tool,
          key: member.key,
          action,
          preparing: tool.derived.state === ToolCallStatusEnum.Pending,
          detail: getToolActivityDetail(tool.derived.summary ?? ""),
        };
        activeSource = source;
        activeAction = action;
        preparing = tool.derived.state === ToolCallStatusEnum.Pending;
        detail = tool.derived.summary
          ? getToolActivityDetail(tool.derived.summary)
          : undefined;
      }
    }
  }
  return {
    activity,
    latestActivity,
    categories: Array.from(counts, ([action, count]) => ({ action, count })),
    observedToolCalls: seen.size,
    activeAction,
    preparing,
    detail,
    reasoningPreview,
    preview: reasoningPreview,
    status: attention
      ? ProcessActivityStatus.Attention
      : running
        ? ProcessActivityStatus.Running
        : ProcessActivityStatus.Settled,
  };
}
