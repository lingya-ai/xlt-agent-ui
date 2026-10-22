import {useCallback} from "react"
import {z} from "zod"

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";

import {useAiChatRequestSignal} from '../../agents/context';
export type {OperationResult as UserInputAnswerOutput, UserInputStatus as UserInputStatusOutput} from '@lingya-ai/agents-sdk/browser';

// ============ Schema ============


export const userInputAnswerParamsSchema = z.object({
  questionId: z.string().min(1),
  selectedOptions: z.array(z.string().min(1)),
  customInput: z.string().trim().min(1).nullable(),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
}).refine(({selectedOptions, customInput}) => {
  return customInput ? selectedOptions.length === 0 : selectedOptions.length > 0
}, {
  message: "预设选项和自定义回答必须且只能提供一种",
  path: ["selectedOptions"],
})




// ============ Types ============

export type {UserInputAnswerInput as UserInputAnswerParams, PlanApprovalInput as PlanApprovalParams} from "@lingya-ai/agents-sdk/browser";
import type {UserInputAnswerInput as UserInputAnswerParams, PlanApprovalInput as PlanApprovalParams} from "@lingya-ai/agents-sdk/browser";

export type UserInputAnswerMessageParams = Omit<UserInputAnswerParams, "conversationId">



// ============ Hooks ============

/**
 * 提交用户对智能体提问的回答
 * @param httpClient - 已配置 basePath 的 HTTP 客户端
 */
export function useSubmitUserInputAnswer(httpClient: AgentsClient) {
  const signal = useAiChatRequestSignal(httpClient);
  return useCallback(async (params: UserInputAnswerParams) => {
    return httpClient.interactions.answerUserInput(userInputAnswerParamsSchema.parse(params), {signal})
  }, [httpClient, signal])
}

/**
 * 查询智能体提问是否仍在等待回答。
 * @param httpClient - 已配置 basePath 的 HTTP 客户端
 */
export function useFetchUserInputStatus(httpClient: AgentsClient) {
  const signal = useAiChatRequestSignal(httpClient);
  return useCallback(async (questionId: string, conversationId: string, messageId: string) => {
    return httpClient.interactions.getUserInputStatus(questionId, {conversationId, messageId, signal})
  }, [httpClient, signal])
}

/**
 * 提交计划审批结果
 * @param httpClient - 已配置 basePath 的 HTTP 客户端
 */
export function useSubmitPlanApproval(httpClient: AgentsClient) {
  const signal = useAiChatRequestSignal(httpClient);
  return useCallback(async (params: PlanApprovalParams) => {
    return httpClient.interactions.approvePlan(params, {signal})
  }, [httpClient, signal])
}

/**
 * 获取计划审批状态（含计划内容）
 * @param httpClient - 已配置 basePath 的 HTTP 客户端
 */
export function useFetchPlanApprovalStatus(httpClient: AgentsClient) {
  const signal = useAiChatRequestSignal(httpClient);
  return useCallback(async (planId: string, _conversationId: string) => {
    return httpClient.interactions.getPlanStatus(planId, {signal})
  }, [httpClient, signal])
}
