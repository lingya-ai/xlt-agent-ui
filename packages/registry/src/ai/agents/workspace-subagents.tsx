"use client";

import { ChevronRight, GitBranch, RefreshCw } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../ui/components/alert";
import { Button } from "../../ui/components/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../ui/components/empty";
import { ScrollArea } from "../../ui/components/scroll-area";
import { Skeleton } from "../../ui/components/skeleton";
import { SubagentType } from "../hooks/use-chat/subagent-schema";
import { SubagentTaskStatusBadge } from "./subagent-task-status";
import { useWorkspaceController } from "./workspace-controller";

/** 当前根会话的子任务列表和详情，不因终态移除历史任务。 */
export function WorkspaceSubagents() {
  const t = useAgentMessages("workspace-subagents");
  const { subagents, selectSubagent } = useWorkspaceController();
  if (!subagents) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h3 className="truncate text-sm font-medium">{t.title}</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void subagents.refresh()}
          disabled={subagents.loading}
          className="cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw
            data-icon="inline-start"
            className={
              subagents.loading
                ? "animate-spin motion-reduce:animate-none"
                : undefined
            }
          />
          {t.refresh}
        </Button>
      </div>
      <ScrollArea
        className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:h-full"
        overflowXHidden
      >
        <div className="flex min-h-full flex-col gap-3 p-4">
          {subagents.error && (
            <Alert variant="destructive">
              <AlertTitle>{t.loadError}</AlertTitle>
              <AlertDescription>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void subagents.refresh()}
                >
                  {t.retry}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!subagents.loaded && subagents.loading ? (
            <div
              role="status"
              aria-label={t.loading.value}
              className="flex flex-col gap-2"
            >
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : subagents.loaded && subagents.tasks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GitBranch aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t.empty}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {subagents.tasks.map((task) => (
                <li key={task.taskId}>
                  <button
                    type="button"
                    onClick={() => selectSubagent(task.taskId)}
                    title={t.open.value}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  >
                    <GitBranch
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="break-words text-sm font-medium">
                        {task.description}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {task.subagentType === SubagentType.FORK
                            ? t.fork
                            : t.general}
                        </span>
                        <SubagentTaskStatusBadge task={task} />
                      </span>
                    </span>
                    <ChevronRight
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
