import {
  type AgentGoal,
  AgentGoalPhase,
  AgentGoalRecordState,
  AgentGoalActivationState,
} from "./agent-goal-schema";
export const goalFixture = (): AgentGoal => ({
    goalId: "g1",
    goalRevision: 1,
    objective: "整理资料\n生成报告",
    phase: AgentGoalPhase.Active,
    recordState: AgentGoalRecordState.Current,
    activationState: AgentGoalActivationState.Armed,
    effectivelyArmed: true,
    blockedCode: null,
    blockedMessage: null,
    completionMessage: null,
    statusVersion: 1,
    nextExecutionDueTime: null,
  });
