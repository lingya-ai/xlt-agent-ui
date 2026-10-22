import { useCallback } from "react";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useAiChatRequestSignal} from "../../agents/context";

import type { ConversationConfig } from "./use-conversation-config";

import type {AgentsConfig, DefaultModel} from "@lingya-ai/agents-sdk/browser";
export type {AgentsConfig, DefaultModel, ModelKeyGroup, ChatModelConfig as AiChatModelConfig, ModelConfig as AgentsModelConfig, AttachmentExtension as AttachmentExt} from "@lingya-ai/agents-sdk/browser";

/**
 * 将会话最近使用的模型与当前 Agent 可用模型合并为前端实际配置。
 *
 * 会话模型不可用时回退 Agent 默认模型；Agent 默认模型也不可用时使用首个可用模型。
 */
export function resolveAgentsConfig(
  agentsConfig: AgentsConfig,
  conversationConfig?: ConversationConfig | null,
): AgentsConfig {
  const { modelKeyGroups } = agentsConfig.modelConfig;
  const findAvailableModel = (candidate: DefaultModel | null | undefined) => {
    if (!candidate) return undefined;
    const group = modelKeyGroups.find(
      (item) => item.keyGroupId === candidate.keyGroupId,
    );
    const model = group?.models.find(
      (item) => item.modelName === candidate.model,
    );
    return group && model ? { group, model } : undefined;
  };

  const conversationModel = findAvailableModel(
    conversationConfig?.lastChatModelSpec,
  );
  const agentDefaultModel = findAvailableModel(
    agentsConfig.modelConfig.defaultModel,
  );
  const fallbackGroup = modelKeyGroups.find((group) => group.models.length > 0);
  const fallbackModel = fallbackGroup?.models[0];
  const selected =
    conversationModel ??
    agentDefaultModel ??
    (fallbackGroup && fallbackModel
      ? { group: fallbackGroup, model: fallbackModel }
      : undefined);

  if (!selected) {
    return {
      ...agentsConfig,
      modelConfig: { ...agentsConfig.modelConfig, defaultModel: null },
    };
  }

  return {
    ...agentsConfig,
    modelConfig: {
      ...agentsConfig.modelConfig,
      defaultModel: {
        keyGroupId: selected.group.keyGroupId,
        model: selected.model.modelName,
      },
    },
  };
}

/** 默认模型身份，用于只在有效默认配置变化时重置输入区状态。 */
export function getDefaultModelSelectionKey(
  model: DefaultModel | null | undefined,
): string {
  return model
    ? `${model.keyGroupId}:${model.model}`
    : "none";
}

// ============ Hook ============

export type UseAgentsConfigOptions = {
  httpClient: AgentsClient;
};

/**
 * 获取智能体配置（模型列表、附件扩展名、联网搜索开关）
 *
 * 调用 GET `<baseURL>/config`，返回智能体运行时配置。
 * httpClient 的 baseURL 应已指向具体智能体的聊天端点。
 *
 * @example
 * ```tsx
 * const fetchConfig = useAgentsConfig({httpClient})
 * const {data, loading} = useRequest(() => fetchConfig())
 * ```
 */
export function useAgentsConfig({ httpClient }: UseAgentsConfigOptions) {
  const signal=useAiChatRequestSignal(httpClient);
  return useCallback(
    () => httpClient.configuration.getAgentsConfig({signal}),
    [httpClient,signal],
  );
}
