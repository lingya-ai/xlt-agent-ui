"use client";

import type { ReactNode } from "react";
import {
  Compass,
  FolderOpen,
  GitBranch,
  History,
  ChevronRight,
} from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { Button } from "../../ui/components/button";
import { ScrollArea } from "../../ui/components/scroll-area";
import { useWorkspaceController } from "./workspace-controller";
import { WorkspacePageKind } from "./workspace-tabs-state";

/** 工作区开始页，只呈现当前宿主提供的能力入口。 */
export function WorkspaceStart() {
  const t = useAgentMessages("workspace-start");
  const { setTab, subagents, goal } = useWorkspaceController();
  const entries = [
    {
      kind: WorkspacePageKind.Artifacts,
      icon: FolderOpen,
      title: t.artifacts,
      description: t.artifactsDescription,
      available: true,
    },
    {
      kind: WorkspacePageKind.Subagents,
      icon: GitBranch,
      title: t.subagents,
      description: t.subagentsDescription,
      available: Boolean(subagents),
    },
    {
      kind: WorkspacePageKind.GoalHistory,
      icon: History,
      title: t.goalHistory,
      description: t.goalHistoryDescription,
      available: Boolean(goal),
    },
  ] satisfies {
    kind: Parameters<typeof setTab>[0];
    icon: typeof FolderOpen;
    title: ReactNode;
    description: ReactNode;
    available: boolean;
  }[];
  return (
    <ScrollArea
      className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:h-full"
      overflowXHidden
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10">
        <Compass
          className="size-12 text-muted-foreground/60"
          aria-hidden="true"
        />
        <div className="flex w-full max-w-md flex-col gap-3">
          {entries
            .filter((entry) => entry.available)
            .map((entry) => (
              <Button
                key={entry.kind}
                variant="outline"
                className="group/entry h-auto min-h-20 w-full cursor-pointer justify-start gap-4 whitespace-normal rounded-xl border-border bg-card px-5 py-4 shadow-none transition-colors duration-150 motion-reduce:transition-none"
                onClick={() => {
                  setTab(entry.kind);
                  if (entry.kind === WorkspacePageKind.Subagents)
                    void subagents?.refresh();
                }}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <entry.icon data-icon="inline-start" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                  <span className="text-sm font-medium leading-5">
                    {entry.title}
                  </span>
                  <span className="text-xs font-normal leading-5 text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
                <ChevronRight
                  data-icon="inline-end"
                  className="text-muted-foreground transition-transform duration-150 group-hover/entry:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                />
              </Button>
            ))}
        </div>
      </div>
    </ScrollArea>
  );
}
