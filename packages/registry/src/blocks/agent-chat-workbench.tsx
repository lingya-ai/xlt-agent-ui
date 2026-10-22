"use client";
import {useState} from "react";
import {AgentChat} from "./agent-chat";
import {ConversationList} from "../ai/agents/conversation-list";
import {useAgentLocale, AgentLocale} from "../i18n/runtime";
import {cn} from "../ui/lib/utils";
import {AgentRichResultsProvider} from "../integration/rich-results";

/** 完整开放渠道组合，包含会话目录、消息、目标控制和制品工作区。 */
export function AgentChatWorkbench({ className, initialConversationId, readOnly = false }: {
  className?: string; initialConversationId?: string; readOnly?: boolean;
}) {
  const {locale} = useAgentLocale();
  const [conversationId, setConversationId] = useState(initialConversationId);
  return <AgentRichResultsProvider><div className={cn("flex h-full min-h-0 overflow-hidden", className)}>
    <aside className="hidden w-64 min-h-0 shrink-0 flex-col border-r md:flex" aria-label={locale === AgentLocale.En ? "Conversations" : "会话列表"}>
      <ConversationList activeConversationId={conversationId} onConversationSelect={setConversationId}
        onNewConversation={() => setConversationId(undefined)} />
    </aside>
    <AgentChat key={conversationId ?? "new"} conversationId={conversationId} readOnly={readOnly}
      className="min-h-0 min-w-0 flex-1" workspace={{ mode: "auto", defaultOpenWhenFilesAvailable: true }} />
  </div></AgentRichResultsProvider>;
}
