import type { AgentsChatMessageViewMode } from "./message-disclosure-policy";
import {
  getActivityPreview,
  getReasoningActivityPreview,
  ProcessActivityStatus,
  ProcessActivityKind,
  type ProcessActivity,
  summarizeProcessActivity,
} from "./process-activity-summary";
import {
  isProtectedTool,
  ProcessMemberKind,
  TurnItemKind,
  type ProcessMember,
  type UnifiedTurnItem,
  type UnifiedTurnProjection,
} from "./unified-assistant-turn";

export enum AssistantTurnSegmentKind {
  ProcessGroup = "process-group",
  ProcessMember = "process-member",
  ProtectedTool = "protected-tool",
  SpecialRenderTool = "special-render-tool",
  Reply = "reply",
  Standalone = "standalone",
}

export type AssistantTurnReply = Extract<
  UnifiedTurnItem,
  { kind: TurnItemKind.Reply }
>;

export type AssistantTurnSegment =
  | {
      kind: AssistantTurnSegmentKind.ProcessGroup;
      key: string;
      /** 重点模式只收纳工具；被收纳的思考与助手文字仅保留为组头预览。 */
      members: ProcessMember[];
      /** 组内没有可渲染成员时只显示摘要行，不提供展开入口。 */
      expandable: boolean;
      summary: ReturnType<typeof summarizeProcessActivity>;
      isActive: boolean;
    }
  | {
      kind: AssistantTurnSegmentKind.ProtectedTool;
      key: string;
      member: Extract<ProcessMember, { kind: ProcessMemberKind.Tool }>;
    }
  | {
      kind: AssistantTurnSegmentKind.SpecialRenderTool;
      key: string;
      /** 特殊渲染工具在重点模式中独立展示，不参与过程组摘要。 */
      member: Extract<ProcessMember, { kind: ProcessMemberKind.Tool }>;
    }
  | {
      kind: AssistantTurnSegmentKind.ProcessMember;
      key: string;
      member: ProcessMember;
    }
  | {
      kind: AssistantTurnSegmentKind.Reply;
      key: string;
      reply: AssistantTurnReply;
    }
  | {
      kind: AssistantTurnSegmentKind.Standalone;
      key: string;
      event: Extract<
        UnifiedTurnItem,
        { kind: TurnItemKind.Standalone }
      >["event"];
    };

interface AssistantTurnSegmentOptions {
  mode: AgentsChatMessageViewMode;
  executing: boolean;
  messageInterrupted?: boolean;
}

/** 按展示模式构造过程段；工具实体及原始投影保持不变。 */
export function buildAssistantTurnSegments(
  projection: UnifiedTurnProjection,
  { mode, executing, messageInterrupted = false }: AssistantTurnSegmentOptions,
): AssistantTurnSegment[] {
  if (mode === "full")
    return buildFullAssistantTurnSegments(
      projection,
      messageInterrupted,
      executing,
    );

  const segments: AssistantTurnSegment[] = [];
  let members: ProcessMember[] = [];
  let activityMembers: ProcessMember[] = [];
  let textActivity: ProcessActivity | undefined;
  // 重点模式下被收纳但不进入组内渲染的思考与助手文字，仅用于组头预览和折叠入口。
  let hiddenContent = false;
  let groupKey: string | undefined;
  let preview: string | undefined;
  const flush = () => {
    if ((members.length > 0 || hiddenContent) && groupKey !== undefined) {
      const summary = summarizeProcessActivity(members);
      const activitySummary = summarizeProcessActivity(activityMembers);
      segments.push({
        kind: AssistantTurnSegmentKind.ProcessGroup,
        key: groupKey,
        members,
        expandable: members.length > 0,
        summary: {
          ...summary,
          activity: textActivity ?? activitySummary.activity,
          latestActivity: textActivity ?? activitySummary.latestActivity,
          status: messageInterrupted
            ? ProcessActivityStatus.Settled
            : summary.status,
          preview: preview ?? summary.preview,
        },
        isActive: false,
      });
    }
    members = [];
    activityMembers = [];
    textActivity = undefined;
    hiddenContent = false;
    groupKey = undefined;
    preview = undefined;
  };

  for (const item of projection.items) {
    if (item.kind === TurnItemKind.ProcessGroup) {
      for (const member of item.members) {
        // 专用结果必须显露在折叠组外；中断回放也保留这一展示边界。
        if (
          member.kind === ProcessMemberKind.Tool &&
          member.tool.specialRender === true
        ) {
          flush();
          segments.push({
            kind: AssistantTurnSegmentKind.SpecialRenderTool,
            key: member.key,
            member,
          });
          continue;
        }
        if (
          member.kind === ProcessMemberKind.Tool &&
          !messageInterrupted &&
          isProtectedTool(member.tool)
        ) {
          flush();
          segments.push({
            kind: AssistantTurnSegmentKind.ProtectedTool,
            key: member.key,
            member,
          });
          continue;
        }
        // 沿用既有单段身份；拆组首段和再次合并都能恢复原有用户选择。
        groupKey ??= `${item.key}:${member.key}`;
        activityMembers.push(member);
        textActivity = undefined;
        // 重点模式只收纳工具，思考保留为组头预览。
        if (member.kind === ProcessMemberKind.Reasoning) {
          const reasoningPreview = member.isStreaming
            ? getReasoningActivityPreview(
                member.events.map((event) => event.message).join(""),
              )
            : undefined;
          hiddenContent = true;
          preview = reasoningPreview;
          continue;
        }
        members.push(member);
        preview = undefined;
      }
      continue;
    }
    if (item.kind === TurnItemKind.Reply) {
      if (!item.events.some((event) => event.message.trim())) continue;
      const replyText = item.events.map((event) => event.message).join("");
      if (members.length > 0)
        preview = getActivityPreview(replyText) ?? preview;
      const protectedReply =
        item.important ||
        (item.key === projection.lastNonEmptyReplyKey && !executing);
      // 执行中的末条文字仍可能是阶段说明，用组头预览承接，避免下一阶段到来后拆组再合并。
      if (!protectedReply) {
        textActivity = {
          kind: ProcessActivityKind.Text,
          key: item.key,
          detail: getActivityPreview(replyText),
        };
        if (members.length === 0) {
          // 初始助手文字就建立折叠入口，后续首个工具沿用它的身份和展开选择。
          groupKey ??= `process:${item.key}`;
          preview = getActivityPreview(replyText) ?? preview;
        }
        // 重点模式的助手文字只做组头预览，不进入组内渲染。
        hiddenContent = true;
        continue;
      }
      flush();
      segments.push({
        kind: AssistantTurnSegmentKind.Reply,
        key: item.key,
        reply: item,
      });
      continue;
    }
    flush();
    segments.push({
      kind: AssistantTurnSegmentKind.Standalone,
      key: item.key,
      event: item.event,
    });
  }
  flush();
  // 最新段在整轮执行期间保持活动，单个工具完成不意味着过程组已经结束。
  const tail = segments[segments.length - 1];
  if (
    executing &&
    !messageInterrupted &&
    tail?.kind === AssistantTurnSegmentKind.ProcessGroup
  )
    tail.isActive = true;
  return segments;
}

/** 完整模式仅收纳连续普通工具，正文、思考、交互及专用结果保留独立边界。 */
function buildFullAssistantTurnSegments(
  projection: UnifiedTurnProjection,
  messageInterrupted: boolean,
  executing: boolean,
): AssistantTurnSegment[] {
  const segments: AssistantTurnSegment[] = [];
  let members: ProcessMember[] = [];
  const flush = () => {
    const first = members[0];
    if (!first) return;
    const summary = summarizeProcessActivity(members);
    segments.push({
      kind: AssistantTurnSegmentKind.ProcessGroup,
      key: `full-tools:${first.key}`,
      members,
      expandable: true,
      summary,
      isActive: false,
    });
    members = [];
  };

  for (const item of projection.items) {
    if (item.kind === TurnItemKind.ProcessGroup) {
      for (const member of item.members) {
        if (
          member.kind === ProcessMemberKind.Tool &&
          member.tool.specialRender !== true &&
          !member.tool.derived.awaitingInput &&
          !member.tool.derived.planApproval &&
          !member.tool.derived.subAgentInfo
        ) {
          members.push(member);
          continue;
        }
        flush();
        if (
          member.kind === ProcessMemberKind.Tool &&
          !messageInterrupted &&
          isProtectedTool(member.tool)
        ) {
          segments.push({
            kind: AssistantTurnSegmentKind.ProtectedTool,
            key: member.key,
            member,
          });
          continue;
        }
        segments.push({
          kind: AssistantTurnSegmentKind.ProcessMember,
          key: member.key,
          member,
        });
      }
      continue;
    }
    if (item.kind === TurnItemKind.Reply) {
      if (!item.events.some((event) => event.message.trim())) continue;
      flush();
      segments.push({
        kind: AssistantTurnSegmentKind.Reply,
        key: item.key,
        reply: item,
      });
      continue;
    }
    flush();
    segments.push({
      kind: AssistantTurnSegmentKind.Standalone,
      key: item.key,
      event: item.event,
    });
  }

  flush();
  const tail = segments[segments.length - 1];
  if (
    executing &&
    !messageInterrupted &&
    tail?.kind === AssistantTurnSegmentKind.ProcessGroup
  )
    tail.isActive = true;
  return segments;
}
