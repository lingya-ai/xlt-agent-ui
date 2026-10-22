import {z} from "zod";
export type {AgentGoal, AgentGoalConfig, AgentGoalRefInput, EditAgentGoalInput} from "@lingya-ai/agents-sdk/browser";
export {AgentGoalPhaseEnum as AgentGoalPhase, AgentGoalRecordStateEnum as AgentGoalRecordState,
  AgentGoalActivationStateEnum as AgentGoalActivationState, AgentGoalBlockedCodeEnum as AgentGoalBlockCode} from "@lingya-ai/agents-sdk/browser";
/** 本地表单校验，不解析或转换 SDK 响应。 */
export const agentGoalRefSchema = z.object({goalId:z.string().min(1).max(64),goalRevision:z.number().int().positive()});
export const editAgentGoalSchema = agentGoalRefSchema.extend({objective:z.string().trim().min(1).max(4000)});
