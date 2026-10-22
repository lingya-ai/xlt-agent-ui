"use client"

import {useCallback, useEffect, useMemo, useState} from "react"

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {clearCache, useRequest} from "../../../api/hooks/use-request/index"
import {useChatClientCacheKey} from "./use-chat-client-cache-key";

import type {ModelConfig} from "./schema"
import {resolveAgentsConfig, useAgentsConfig} from "./use-agents-config"
import {
  type ConversationConfig,
  useConversationConfig,
} from "./use-conversation-config"

const AGENTS_CONFIG_CACHE_TIME = 5 * 60_000

type ConversationConfigResult = {
  conversationId: string
  config: ConversationConfig | null
}

type VisibleChatModelSpec = Pick<ModelConfig, "keyGroupId" | "model" | "thinking">

/**
 * 组合当前 Agent 配置和历史会话配置，并隔离会话切换时的旧请求结果。
 */
export function useEffectiveAgentsConfig({
  httpClient,
  conversationId,
  enabled,
}: {
  httpClient: AgentsClient
  conversationId?: string
  enabled: boolean
}) {
  const fetchAgentsConfig = useAgentsConfig({httpClient})
  const agentsConfigCacheKey = useChatClientCacheKey(httpClient, 'agents-chat-config')
  const agentsConfigRequest = useRequest(fetchAgentsConfig, {
    ready: enabled,
    cacheKey: agentsConfigCacheKey,
    cacheTime: AGENTS_CONFIG_CACHE_TIME,
    staleTime: AGENTS_CONFIG_CACHE_TIME,
    refreshDeps: [httpClient],
    // Agent 配置错误由 AgentsChat 的不可用状态统一展示。
    onError: () => undefined,
  })

  const fetchConversationConfig = useConversationConfig({httpClient})
  const loadConversationConfig = useCallback(
    async (targetConversationId: string): Promise<ConversationConfigResult> => {
      try {
        return {
          conversationId: targetConversationId,
          config: await fetchConversationConfig(targetConversationId),
        }
      } catch {
        // 会话配置是可降级信息；失败时继续使用当前 Agent 默认配置。
        return {
          conversationId: targetConversationId,
          config: null,
        }
      }
    },
    [fetchConversationConfig],
  )
  const conversationConfigRequest = useRequest(loadConversationConfig, {
    manual: true,
  })
  const {
    cancel: cancelConversationConfig,
    mutate: mutateConversationConfig,
    run: runConversationConfig,
  } = conversationConfigRequest
  const {
    data: agentsConfig,
    error: agentsConfigError,
    loading: agentsConfigLoading,
    refresh: refreshAgentsConfig,
  } = agentsConfigRequest

  useEffect(() => {
    if (!enabled || !conversationId) {
      cancelConversationConfig()
      return
    }
    runConversationConfig(conversationId)
  }, [cancelConversationConfig, conversationId, enabled, runConversationConfig])

  const [optimisticConfig, setOptimisticConfig] = useState<ConversationConfigResult | null>(null)
  const serverConversationConfig = conversationConfigRequest.data?.conversationId === conversationId
    ? conversationConfigRequest.data
    : undefined
  const localConversationConfig = optimisticConfig?.conversationId === conversationId
    ? optimisticConfig
    : undefined
  const matchedConversationConfig = serverConversationConfig ?? localConversationConfig
  const conversationConfigPending = Boolean(
    enabled
    && conversationId
    && !matchedConversationConfig,
  )

  const effectiveConfig = useMemo(
    () => agentsConfig
      ? resolveAgentsConfig(agentsConfig, matchedConversationConfig?.config)
      : undefined,
    [agentsConfig, matchedConversationConfig?.config],
  )

  const rememberConversationModel = useCallback((
    targetConversationId: string,
    chatModelSpec: VisibleChatModelSpec | undefined,
    planMode?: boolean,
  ) => {
    setOptimisticConfig({
      conversationId: targetConversationId,
      config: {lastChatModelSpec: chatModelSpec ?? null, planMode: planMode ?? false},
    })
    // 清除同会话旧响应，先使用本地已提交配置，再以服务端结果校正。
    mutateConversationConfig(undefined)
    runConversationConfig(targetConversationId)
  }, [mutateConversationConfig, runConversationConfig])

  const refreshConfig = useCallback(() => {
    clearCache(agentsConfigCacheKey)
    refreshAgentsConfig()
    if (conversationId) runConversationConfig(conversationId)
  }, [agentsConfigCacheKey, conversationId, refreshAgentsConfig, runConversationConfig])

  const refreshConversationConfig = useCallback(() => {
    if (enabled && conversationId) runConversationConfig(conversationId)
  }, [conversationId, enabled, runConversationConfig])

  return {
    config: effectiveConfig,
    thinking: Boolean(matchedConversationConfig?.config?.lastChatModelSpec?.thinking && effectiveConfig?.modelConfig.defaultModel?.keyGroupId === matchedConversationConfig.config.lastChatModelSpec.keyGroupId && effectiveConfig.modelConfig.defaultModel.model === matchedConversationConfig.config.lastChatModelSpec.model),
    loading: enabled && (agentsConfigLoading || conversationConfigPending),
    error: agentsConfigError,
    refreshConfig,
    rememberConversationModel,
    planMode: matchedConversationConfig?.config?.planMode,
    refreshConversationConfig,
  }
}
