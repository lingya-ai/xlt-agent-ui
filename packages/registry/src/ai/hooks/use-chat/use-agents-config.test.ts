import {describe, expect, it} from "vitest"

import type {ConversationConfig} from "./use-conversation-config"
import {
  getDefaultModelSelectionKey,
  resolveAgentsConfig,
  type AgentsConfig,
} from "./use-agents-config"

const agentsConfig: AgentsConfig = {
  modelConfig: {
    defaultModel: {keyGroupId: 1, model: "default-model"},
    modelKeyGroups: [
      {
        keyGroupId: 1,
        keyGroupName: "默认组",
        models: [
          {
            maker: "maker",
            modelName: "default-model",
            modelLabel: "默认模型",
            modelDescription: "",
            maxContextTokens: 1000,
            maxOutputTokens: 100,
            supportImage: false,
            supportVideo: false,
            thinkingMode: false,
          },
        ],
      },
      {
        keyGroupId: 2,
        keyGroupName: "推理组",
        models: [
          {
            maker: "maker",
            modelName: "thinking-model",
            modelLabel: "推理模型",
            modelDescription: "",
            maxContextTokens: 2000,
            maxOutputTokens: 200,
            supportImage: false,
            supportVideo: false,
            thinkingMode: true,
          },
        ],
      },
    ],
  },
  supportAttachmentExt: [],
  maxAttachmentCount: 10,
}

describe("resolveAgentsConfig", () => {
  it("新会话使用 Agent 默认模型", () => {
    const resolved = resolveAgentsConfig(agentsConfig)

    expect(resolved.modelConfig.defaultModel).toEqual({
      keyGroupId: 1,
      model: "default-model",
    })
  })

  it("历史会话恢复最近使用的模型", () => {
    const conversationConfig: ConversationConfig = {
      planMode: false,
      lastChatModelSpec: {
        keyGroupId: 2,
        model: "thinking-model",
        },
    }

    const resolved = resolveAgentsConfig(agentsConfig, conversationConfig)

    expect(resolved.modelConfig.defaultModel).toEqual({
      keyGroupId: 2,
      model: "thinking-model",
    })
  })

  it("历史模型不可用时回退 Agent 默认模型", () => {
    const conversationConfig: ConversationConfig = {
      planMode: false,
      lastChatModelSpec: {
        keyGroupId: 9,
        model: "removed-model",
        },
    }

    const resolved = resolveAgentsConfig(agentsConfig, conversationConfig)

    expect(resolved.modelConfig.defaultModel).toEqual({
      keyGroupId: 1,
      model: "default-model",
    })
  })

  it("Agent 默认模型不可用时回退首个可用模型", () => {
    const resolved = resolveAgentsConfig({
      ...agentsConfig,
      modelConfig: {
        ...agentsConfig.modelConfig,
        defaultModel: {keyGroupId: 9, model: "removed-model"},
      },
    })

    expect(resolved.modelConfig.defaultModel).toEqual({
      keyGroupId: 1,
      model: "default-model",
    })
  })

  it("默认模型身份仅使用 SDK DefaultModel 字段", () => {
    expect(getDefaultModelSelectionKey({
      keyGroupId: 2,
      model: "thinking-model",
    })).toBe("2:thinking-model")
  })
})
