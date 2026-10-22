"use client";

import { useEffect, useState } from "react";
import { History, Pencil } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { useApiRequest } from "../../api/hooks/use-api-request";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../ui/components/dialog";
import { ScrollArea } from "../../ui/components/scroll-area";
import { Button } from "../../ui/components/button";
import { Separator } from "../../ui/components/separator";
import { Alert, AlertDescription } from "../../ui/components/alert";
import { Skeleton } from "../../ui/components/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../ui/components/empty";
import { cn } from "../../ui/lib/utils";
import {
  AgentGoalPhase,
  AgentGoalRecordState,
  type AgentGoal,
  type AgentGoalConfig,
} from "../hooks/use-chat/agent-goal-schema";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";
import { AgentGoalClear, AgentGoalStatus } from "./agent-goal-bar";
import { AgentGoalForm } from "./agent-goal-form";
import { AgentGoalToggle } from "./agent-goal-toggle";

/** 按需读取目标历史与状态。 */
export function AgentGoalDetails({
  controller,
  config,
  conversationId,
  open,
  onOpenChange,
  onCloseAutoFocus,
  embedded = false,
  historyOnly = false,
}: {
  controller: AgentGoalController;
  config: AgentGoalConfig;
  conversationId?: string;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** 工作区标签页内直接展示内容，复用详情的查询和操作。 */
  embedded?: boolean;
  /** 目标历史栏目仅查询历史记录，不启动人工请求轮询。 */
  historyOnly?: boolean;
}) {
  const t = useAgentMessages("agent-goal-details");
  const [editingGoal, setEditingGoal] = useState<AgentGoal | null>(null);
  const history = useApiRequest(
    async () =>
      conversationId ? controller.api.getGoalHistory(conversationId,{signal:controller.signal}) : null,
    {
      ready: open && Boolean(conversationId),
      refreshDeps: [conversationId, controller.invalidated],
      disableErrorNotification: true,
    },
  );
  useEffect(() => {
    setEditingGoal(null);
  }, [conversationId, controller.goal?.goalId, controller.expiredGeneration, open]);
  const content = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {historyOnly && (
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
          <h3 className="shrink-0 text-sm font-medium">{t.history}</h3>
          <p className="truncate text-xs text-muted-foreground">{t.limit}</p>
        </div>
      )}
      <ScrollArea
        className={cn(
          "min-h-0 flex-1",
          historyOnly && "[&_[data-slot=scroll-area-viewport]>div]:h-full",
        )}
        overflowXHidden
      >
        <div
          className={cn(
            "flex min-w-0 flex-col gap-4 p-4",
            historyOnly && "min-h-full",
          )}
        >
          {!historyOnly && (
            <>
              {controller.goal ? (
                <section className="flex flex-col gap-2">
                  <AgentGoalStatus goal={controller.goal} />
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {controller.goal.objective}
                  </p>
                  {controller.goal.blockedMessage && (
                    <Alert>
                      <AlertDescription>
                        {controller.goal.blockedMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                  {controller.goal.completionMessage && (
                    <Alert>
                      <AlertDescription>
                        {controller.goal.completionMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                  {!config.continuationEnabled && (
                    <p className="text-sm text-muted-foreground">
                      {t.disabled}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        controller.loading ||
                        controller.goal.phase === AgentGoalPhase.Complete
                      }
                      onClick={() => setEditingGoal(controller.goal)}
                    >
                      <Pencil />
                      {t.edit}
                    </Button>
                    <AgentGoalToggle controller={controller} />
                    <AgentGoalClear controller={controller} />
                  </div>
                  {editingGoal && (
                    <AgentGoalForm
                      controller={controller}
                      initialGoal={editingGoal}
                      onCancel={() => setEditingGoal(null)}
                      onSuccess={() => setEditingGoal(null)}
                    />
                  )}
                </section>
              ) : (
                <p className="text-sm text-muted-foreground">{t.noCurrent}</p>
              )}
              <Separator />
            </>
          )}
          {!historyOnly && (
            <>
              <h3 className="font-medium">{t.history}</h3>
              <p className="text-xs text-muted-foreground">{t.limit}</p>
            </>
          )}
          {history.error ? (
            <Alert>
              <AlertDescription>{t.failed}</AlertDescription>
              <Button type="button" variant="outline" onClick={history.refresh}>
                {t.retry}
              </Button>
            </Alert>
          ) : history.loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex flex-col gap-3 rounded-lg border p-4"
                >
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : history.data?.items.length ? (
            history.data.items.map((goal) => (
              <div
                key={goal.goalId}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <AgentGoalStatus goal={goal} />
                <p className="whitespace-pre-wrap break-words text-sm">
                  {goal.objective}
                </p>
                <p className="text-xs text-muted-foreground">{goal.phase}</p>
                {goal.blockedMessage?.trim() && (
                  <section className="flex min-w-0 flex-col gap-1 border-t pt-2">
                    <h4 className="text-xs font-medium">{t.blockedReason}</h4>
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {goal.blockedMessage}
                    </p>
                  </section>
                )}
                <p className="text-xs text-muted-foreground">
                  {goal.recordState === AgentGoalRecordState.Cleared
                    ? t.cleared
                    : goal.recordState === AgentGoalRecordState.Replaced
                      ? t.replaced
                      : t.current}
                </p>
              </div>
            ))
          ) : historyOnly ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t.noHistory}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noHistory}</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
  if (embedded) return content;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(640px,calc(100vh-2rem))] min-h-0 min-w-0 flex-col overflow-hidden sm:max-w-xl"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
