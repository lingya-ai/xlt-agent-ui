"use client";

import { ChevronRight, GitBranch } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import type { SubagentTasksState } from "../hooks/use-chat/use-subagent-tasks";

interface AgentsChatSubagentsProps {
  state: SubagentTasksState;
  onOpen: () => void;
}

/** 输入框贴片中的子任务入口，点击后进入共享工作区。 */
export function AgentsChatSubagents({
  state,
  onOpen,
}: AgentsChatSubagentsProps) {
  const t = useAgentMessages("agents-chat-subagents");
  if (state.activeCount === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={t.open.value}
      className="flex min-h-7 w-full flex-wrap items-center gap-2 px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <GitBranch className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium text-foreground">
        {t.title({ count: state.tasks.length })}
      </span>
      {state.activeCount > 0 && (
        <span>{t.active({ count: state.activeCount })}</span>
      )}
      {state.hasUnreadTerminalResults && <span>{t.unread}</span>}
      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
    </button>
  );
}
