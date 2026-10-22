import {z} from "zod";
import type {SubagentTask} from '@lingya-ai/agents-sdk/browser';
export type {SubagentTask, SubagentTaskResult as SubagentResult} from '@lingya-ai/agents-sdk/browser';


/** 后台子任务的执行状态，与工具提交状态独立。 */
export enum SubagentTaskStatus {
  SUBMITTING = "SUBMITTING",
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum SubagentType {
  GENERAL_PURPOSE = "GENERAL_PURPOSE",
  FORK = "FORK",
}

export enum SubagentNotificationStatus {
  WAITING = "WAITING",
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  NOT_REQUIRED = "NOT_REQUIRED",
}

export enum SubagentDeliveryStatus {
  NOT_APPLICABLE = "NOT_APPLICABLE",
  UNVALIDATED = "UNVALIDATED",
  ACCEPTED = "ACCEPTED",
  ACCEPTED_WITH_WARNINGS = "ACCEPTED_WITH_WARNINGS",
  BLOCKED = "BLOCKED",
}

export const subagentSyncInputSchema = z.object({
  cursor: z.string().max(1048576).optional(),
  size: z.number().int().min(1).max(100).default(50),
});

/** 判断子任务是否仍在等待或执行。 */
export function isSubagentActive(task: Pick<SubagentTask, "status">): boolean {
  return (
    task.status === SubagentTaskStatus.SUBMITTING ||
    task.status === SubagentTaskStatus.PENDING ||
    task.status === SubagentTaskStatus.RUNNING
  );
}

/** 执行中任务优先、等待任务次之，同组按创建时间倒序，避免状态更新打乱列表。 */
export function sortSubagentTasks(
  tasks: readonly SubagentTask[],
): SubagentTask[] {
  const priority = (task: SubagentTask) =>
    task.status === SubagentTaskStatus.RUNNING
      ? 0
      : isSubagentActive(task)
        ? 1
        : 2;
  return [...tasks].sort(
    (a, b) =>
      priority(a) - priority(b) ||
      b.createdTime.getTime() - a.createdTime.getTime() ||
      a.taskId.localeCompare(b.taskId),
  );
}
