import {
  AgentGoalPhase,
  AgentGoalRecordState,
  type AgentGoal,
} from "./agent-goal-schema";

/** 恢复动作被禁止的原因，供界面本地化。 */
export enum GoalResumeBlock {
  COMPLETE = "COMPLETE",
  ARMED = "ARMED",
}

/** 只依据权威快照判断恢复前置条件，不自动授予续跑许可。 */
export function goalResumeBlock(goal: AgentGoal): GoalResumeBlock | null {
  if (
    goal.recordState !== AgentGoalRecordState.Current ||
    goal.phase === AgentGoalPhase.Complete
  )
    return GoalResumeBlock.COMPLETE;
  if (goal.phase === AgentGoalPhase.Active && goal.effectivelyArmed)
    return GoalResumeBlock.ARMED;
  return null;
}

/** 仅将输入开头的完整 /goal 命令识别为目标操作。 */
export function parseGoalCommand(text: string): string | null {
  const match = /^\s*\/goal(?:\s+([\s\S]*))?\s*$/.exec(text);
  return match ? (match[1] ?? "").trim() : null;
}

/** 忽略旧版本状态。 */
export function reconcileGoal(
  previous: AgentGoal | null,
  next: AgentGoal | null,
): AgentGoal | null {
  if (
    previous &&
    next &&
    previous.goalId === next.goalId &&
    previous.statusVersion > next.statusVersion
  )
    return previous;
  return next;
}
