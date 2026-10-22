"use client";

import type { ReactNode } from "react";
import { MessageContent } from "../components/message";
import { CitationMessageResponse } from "../components/citation-message-response";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../components/reasoning";
import type {
  AssistantStandaloneEvent,
  AgentsChatMessageViewMode,
  AssistantTurnProjection,
} from "./message-disclosure-policy";
import { ProcessGroup } from "./process-group";
import {
  AssistantTurnSegmentKind,
  buildAssistantTurnSegments,
  type AssistantTurnReply,
} from "./assistant-turn-segments";
import {
  ProcessMemberKind,
  type ProcessMember,
} from "./unified-assistant-turn";
import {
  DisclosureScope,
  type MessageDisclosureState,
} from "./use-message-disclosure-state";
import {
  ToolEventsBlock,
  type ToolEventsBlockProps,
} from "./tool-events-block";

interface AssistantTurnProcessProps {
  projection: AssistantTurnProjection;
  executing: boolean;
  viewMode: AgentsChatMessageViewMode;
  messageId: string;
  disclosure: MessageDisclosureState;
  toolProps: Omit<ToolEventsBlockProps, "tools">;
  renderStandalone: (event: AssistantStandaloneEvent) => ReactNode;
}

/** 重点模式收纳普通工具，重点工具与待处理工具独立显示；完整模式按原始顺序展示。 */
export function AssistantTurnProcess({
  projection,
  executing,
  viewMode,
  messageId,
  disclosure,
  toolProps,
  renderStandalone,
}: AssistantTurnProcessProps) {
  const renderReply = (reply: AssistantTurnReply) => (
    <MessageContent key={reply.key}>
      <CitationMessageResponse>
        {reply.events.map((event) => event.message).join("")}
      </CitationMessageResponse>
    </MessageContent>
  );
  const renderMember = (member: ProcessMember): ReactNode => {
    if (member.kind === ProcessMemberKind.Tool)
      return (
        <ToolEventsBlock
          key={member.key}
          {...toolProps}
          viewMode={viewMode}
          tools={[member.tool]}
          getToolOpen={(id) =>
            disclosure.get(messageId, DisclosureScope.Tool, id, viewMode)
          }
          onToolOpenChange={(id, open) =>
            disclosure.set(messageId, DisclosureScope.Tool, id, open, viewMode)
          }
          getSubAgentMessagesOpen={(id) =>
            disclosure.get(
              messageId,
              DisclosureScope.SubAgentMessages,
              id,
              viewMode,
            )
          }
          onSubAgentMessagesOpenChange={(id, open) =>
            disclosure.set(
              messageId,
              DisclosureScope.SubAgentMessages,
              id,
              open,
              viewMode,
            )
          }
        />
      );
    return (
      <Reasoning
        key={member.key}
        isStreaming={member.isStreaming}
        open={
          disclosure.get(
            messageId,
            DisclosureScope.Reasoning,
            member.key,
            viewMode,
          ) ?? viewMode === "full"
        }
        onOpenChange={(open) =>
          disclosure.set(
            messageId,
            DisclosureScope.Reasoning,
            member.key,
            open,
            viewMode,
          )
        }
      >
        <ReasoningTrigger />
        <ReasoningContent>
          {member.events.map((event) => event.message).join("")}
        </ReasoningContent>
      </Reasoning>
    );
  };
  const segments = buildAssistantTurnSegments(projection, {
    mode: viewMode,
    executing,
    messageInterrupted: toolProps.messageInterrupted,
  });
  return (
    <>
      {segments.map((item) => {
        if (item.kind === AssistantTurnSegmentKind.ProcessGroup)
          return (
            <ProcessGroup
              key={`${toolProps.conversationId ?? ""}:${messageId}:${viewMode}:${item.key}`}
              summary={item.summary}
              expandable={item.expandable}
              isActive={executing && item.isActive}
              open={
                disclosure.get(
                  messageId,
                  DisclosureScope.Group,
                  item.key,
                  viewMode,
                ) ?? viewMode === "full"
              }
              onOpenChange={(open) =>
                disclosure.set(
                  messageId,
                  DisclosureScope.Group,
                  item.key,
                  open,
                  viewMode,
                )
              }
            >
              {item.members.map(renderMember)}
            </ProcessGroup>
          );
        if (item.kind === AssistantTurnSegmentKind.ProcessMember)
          return renderMember(item.member);
        if (item.kind === AssistantTurnSegmentKind.ProtectedTool)
          return renderMember(item.member);
        if (item.kind === AssistantTurnSegmentKind.SpecialRenderTool)
          return renderMember(item.member);
        if (item.kind === AssistantTurnSegmentKind.Standalone)
          return <div key={item.key}>{renderStandalone(item.event)}</div>;
        return renderReply(item.reply);
      })}
    </>
  );
}
