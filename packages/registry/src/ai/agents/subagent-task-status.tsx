"use client";

import { useAgentMessages } from "../../i18n/runtime";
import { Badge } from "../../ui/components/badge";
import {
  SubagentTaskStatus,
  type SubagentTask,
} from "../hooks/use-chat/subagent-schema";

interface SubagentTaskStatusBadgeProps {
  task: SubagentTask;
}

/** 展示后台权威状态，取消请求受理后仍等待实际终态。 */
export function SubagentTaskStatusBadge({
  task,
}: SubagentTaskStatusBadgeProps) {
  const t = useAgentMessages("subagent-task-status");
  const label =
    task.phase === "cancelling"
      ? t.cancelling
      : task.phase === "waiting_capacity"
        ? t.waitingCapacity
        : (Object.prototype.hasOwnProperty.call(t.statuses, task.status) ? t.statuses[task.status as keyof typeof t.statuses] : task.status);
  const additionalPhase =
    task.phase &&
    task.phase !== task.status.toLowerCase() &&
    task.phase !== "cancelling" &&
    task.phase !== "waiting_capacity";
  return (
    <>
      <Badge
        variant={
          task.status === SubagentTaskStatus.FAILED
            ? "destructive"
            : "secondary"
        }
      >
        {label}
      </Badge>
      {additionalPhase && (
        <span className="break-words text-xs text-muted-foreground">
          {task.phase}
        </span>
      )}
    </>
  );
}
