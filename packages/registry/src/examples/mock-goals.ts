import {z} from "zod";
import {
  AgentGoalActivationState, AgentGoalPhase, AgentGoalRecordState,
  agentGoalRefSchema, editAgentGoalSchema, type AgentGoal,
} from "../ai/hooks/use-chat/agent-goal-schema";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {"Content-Type": "application/json"},
});
const error = (status: number, code: string, message: string) => json({code, message}, status);
const objectiveSchema = z.string().trim().min(1).max(4000);

/** 会话独享的目标模拟：保留墓碑和版本冲突；不模拟真实 Agent 自动执行。 */
export function createMockGoals() {
  const records = new Map<string, AgentGoal[]>();
  let sequence = 0;
  const list = (id: string) => records.get(id) ?? [];
  const current = (id: string) => list(id).find(goal => goal.recordState === AgentGoalRecordState.Current);
  return {
    create(id: string, objective: unknown): Response | undefined {
      const parsed = objectiveSchema.safeParse(objective);
      if (!parsed.success) return error(400, "ai.agent_goal.invalid_objective", "目标正文必须为 1 到 4000 个字符");
      const existing = current(id);
      if (existing && existing.phase !== AgentGoalPhase.Complete) {
        return error(409, "ai.agent_goal.already_exists", "当前会话已存在未完成的目标");
      }
      if (existing) existing.recordState = AgentGoalRecordState.Replaced;
      const goal: AgentGoal = {
        goalId: `demo-goal-${++sequence}`, goalRevision: 1, objective: parsed.data,
        phase: AgentGoalPhase.Active, recordState: AgentGoalRecordState.Current,
        activationState: AgentGoalActivationState.Armed, effectivelyArmed: true,
        blockedCode: null, blockedMessage: null, completionMessage: null,
        statusVersion: 1, nextExecutionDueTime: new Date(),
      };
      records.set(id, [goal, ...list(id)]);
    },
    handle(url: URL, method: string, body: unknown): Response | undefined {
      const match = url.pathname.match(/\/conversations\/([^/]+)\/goal(?:\/(history|pause|resume|clear))?$/);
      if (!match) return;
      const id = decodeURIComponent(match[1]!);
      const action = match[2];
      const goal = current(id);
      if (method === "GET" && !action) return json({goal: goal ?? null});
      if (method === "GET" && action === "history") {
        const page = Number(url.searchParams.get("page") ?? 0);
        const size = Number(url.searchParams.get("size") ?? 20);
        if (!Number.isSafeInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100 || page * size > 2147483647) {
          return error(400, "ai.agent_goal.invalid_page", "目标历史分页参数超出有效范围");
        }
        const all = list(id);
        return json({items: all.slice(page * size, (page + 1) * size), page, size, hasNext: (page + 1) * size < all.length});
      }
      if (!(method === "PATCH" && !action) && !(method === "POST" && ["pause", "resume", "clear"].includes(action ?? ""))) {
        return error(405, "method-not-allowed", "模拟目标接口不支持该方法");
      }
      const input = (!action ? editAgentGoalSchema : agentGoalRefSchema).safeParse(body);
      if (!input.success) return error(400, "ai.agent_goal.invalid_input", "目标参数无效");
      if (!goal) return error(404, "ai.agent_goal.not_found", "当前会话没有目标");
      if (input.data.goalId !== goal.goalId) return error(410, "ai.agent_goal.replaced", "该目标已被清除或替换");
      if (input.data.goalRevision !== goal.goalRevision) return error(409, "ai.agent_goal.stale_revision", "目标已被其他操作修改，请重新读取");
      if (action === "pause" && goal.phase === AgentGoalPhase.Paused) return json(goal);
      if (action === "pause" && goal.phase !== AgentGoalPhase.Active && goal.phase !== AgentGoalPhase.Blocked) {
        return error(409, "ai.agent_goal.invalid_transition", "只有活跃或受阻目标可以暂停");
      }
      if (action === "resume" && goal.phase === AgentGoalPhase.Complete) return error(409, "ai.agent_goal.invalid_transition", "已完成的目标不能恢复");
      if (!action && "objective" in input.data && typeof input.data.objective === "string") goal.objective = input.data.objective;
      if (action === "pause" || action === "clear") {
        goal.activationState = AgentGoalActivationState.Disarmed;
        goal.effectivelyArmed = false;
        goal.nextExecutionDueTime = null;
      }
      if (action === "pause") goal.phase = AgentGoalPhase.Paused;
      if (action === "resume") {
        goal.phase = AgentGoalPhase.Active;
        goal.activationState = AgentGoalActivationState.Armed;
        goal.effectivelyArmed = true;
        goal.blockedCode = null; goal.blockedMessage = null;
        goal.nextExecutionDueTime = new Date();
      }
      if (action === "clear") goal.recordState = AgentGoalRecordState.Cleared;
      goal.goalRevision += 1; goal.statusVersion += 1;
      records.set(id, [goal, ...list(id).filter(item => item.goalId !== goal.goalId)]);
      return json(goal);
    },
  };
}
