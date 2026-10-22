import {
  SubagentTaskStatus,
  type SubagentTask,
} from "./subagent-schema";

/** 定向测试使用的后端子任务快照。 */
export function createSubagentTask(
  overrides: Partial<SubagentTask> = {},
): SubagentTask {
  return {
    taskId: "task-1",
    description: "检索资料",
    subagentType: "GENERAL_PURPOSE",
    status: SubagentTaskStatus.RUNNING,
    phase: "running",
    parentConversationId: "parent",
    parentMessageId: "parent-message",
    childConversationId: "child",
    childMessageId: "child-message",
    resultAvailable: false,
    artifactCount: 0,
    notificationStatus: "WAITING",
    failureCode: null,
    failureMessage: null,
    createdTime: new Date(new Date("2026-10-07T00:00:00Z")),
    startedTime: null,
    completedTime: null,
    lastUpdateTime: new Date(new Date("2026-10-07T00:00:00Z")),
    cancellable: true,
    ...overrides,
  };
}
