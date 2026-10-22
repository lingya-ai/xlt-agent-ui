"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { useApiRequest } from "../../api/hooks/use-api-request";
import { Button } from "../../ui/components/button";
import { Badge } from "../../ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/components/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "../../ui/components/alert-dialog";
import { toast } from "../../ui/components/sonner";
import {
  AgentGoalPhase,
  type AgentGoal,
} from "../hooks/use-chat/agent-goal-schema";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";
import { AgentGoalToggle } from "./agent-goal-toggle";
import { AgentGoalForm } from "./agent-goal-form";

/** 生命周期标签由相位与有效激活共同决定。 */
export function AgentGoalStatus({ goal }: { goal: AgentGoal }) {
  const t = useAgentMessages("agent-goal-status");
  return (
    <Badge variant="secondary">
      {goal.phase === AgentGoalPhase.Complete
        ? t.complete
        : goal.phase === AgentGoalPhase.Blocked
          ? t.blocked
          : goal.phase === AgentGoalPhase.Paused
            ? t.paused
            : goal.effectivelyArmed
              ? t.armed
              : t.disarmed}
    </Badge>
  );
}

/** 清除按钮与确认弹窗共同持有开关，不删除目标历史。 */
export function AgentGoalClear({
  controller,
  showLabel = false,
  disabled = false,
}: {
  controller: AgentGoalController;
  showLabel?: boolean;
  disabled?: boolean;
}) {
  const t = useAgentMessages("agent-goal-clear");
  const [open, setOpen] = useState(false);
  const request = useApiRequest(() => controller.clear(), {
    manual: true,
    onSuccess: () => {
      setOpen(false);
      toast.success(t.cleared);
    },
  });
  const loading = request.loading || controller.loading || disabled;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) setOpen(value);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size={showLabel ? "sm" : "icon"}
          variant="ghost"
          disabled={loading}
          aria-label={t.title.value}
        >
          {showLabel ? t.title : <Trash2 />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.title}</AlertDialogTitle>
          <AlertDialogDescription>{t.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t.cancel}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() => request.run()}
          >
            {t.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** 单行展示目标状态和摘要，编辑使用模态框，历史由工作区承接。 */
export function AgentGoalBar({
  controller,
}: {
  controller: AgentGoalController;
}) {
  const t = useAgentMessages("agent-goal-bar");
  const goal = controller.goal;
  const [editingGoal, setEditingGoal] = useState<AgentGoal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setEditingGoal(null);
    setSubmitting(false);
  }, [goal?.goalId, controller.expiredGeneration]);
  if (!goal || goal.phase === AgentGoalPhase.Complete) return null;
  return (
    <Dialog
      open={editingGoal !== null}
      onOpenChange={(open) => {
        if (!controller.loading && !submitting) setEditingGoal(open ? goal : null);
      }}
    >
      <div className="flex h-8 min-w-0 items-center gap-2 px-3" data-goal-bar>
        <AgentGoalStatus goal={goal} />
        <span className="min-w-0 flex-1 truncate text-xs" title={goal.objective}>
          {goal.objective}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <DialogTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={controller.loading}
              aria-label={t.edit.value}
              title={t.edit.value}
            >
              <Pencil />
            </Button>
          </DialogTrigger>
          <AgentGoalToggle controller={controller} />
        </div>
      </div>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] min-h-0 min-w-0 flex-col overflow-hidden sm:max-w-xl"
        showCloseButton={!submitting}
      >
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>{t.edit}</DialogTitle>
          <DialogDescription>{t.editDescription}</DialogDescription>
        </DialogHeader>
        {editingGoal && (
          <AgentGoalForm
            controller={controller}
            initialGoal={editingGoal}
            onSuccess={() => setEditingGoal(null)}
            onCancel={() => setEditingGoal(null)}
            onSubmittingChange={setSubmitting}
            showSaveAndStart
            footerStart={
              <AgentGoalClear controller={controller} showLabel disabled={submitting} />
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
