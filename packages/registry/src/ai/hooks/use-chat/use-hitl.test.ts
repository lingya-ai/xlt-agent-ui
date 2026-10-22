import {UserInputStatusFromJSON,OperationResultFromJSON} from "@lingya-ai/agents-sdk/browser";
import {describe, expect, it} from "vitest"

import {

  userInputAnswerParamsSchema,

} from "./use-hitl"

describe("用户提问接口响应契约", () => {
  it("解析仍在等待回答的状态", () => {
    expect(UserInputStatusFromJSON({
      pending: true,
      question: "请选择发布环境",
      questionDetails: "发布环境会影响后续执行目标。",
      options: [
        "测试环境",
        "生产环境",
      ],
      multiple: false,
    })).toEqual({
      pending: true,
      question: "请选择发布环境",
      questionDetails: "发布环境会影响后续执行目标。",
      options: [
        "测试环境",
        "生产环境",
      ],
      multiple: false,
    })
  })

  it("兼容已结束状态中的空字段", () => {
    expect(UserInputStatusFromJSON({
      pending: false,
      question: null,
      questionDetails: null,
      options: null,
      multiple: null,
    })).toEqual({
      pending: false,
      question: null,
      questionDetails: null,
      options: null,
      multiple: null,
    })
  })

  it("保留 SDK 未提供的问题详细说明", () => {
    expect(UserInputStatusFromJSON({
      pending: true,
      question: "请选择发布环境",
      options: ["测试环境"],
      multiple: false,
    }).questionDetails).toBeUndefined()
  })

  it("解析重复提交等业务失败响应", () => {
    expect(OperationResultFromJSON({
      success: false,
      message: "该问题已回答或已过期",
    })).toEqual({
      success: false,
      message: "该问题已回答或已过期",
    })
  })

  it("预设选项回答显式提交空 customInput", () => {
    expect(userInputAnswerParamsSchema.parse({
      conversationId: "conversation-1",
      messageId: "message-1",
      questionId: "question-1",
      selectedOptions: ["测试环境"],
      customInput: null,
    })).toMatchObject({
      selectedOptions: ["测试环境"],
      customInput: null,
    })
  })

  it("自定义回答必须清空预设选项", () => {
    expect(userInputAnswerParamsSchema.parse({
      conversationId: "conversation-1",
      messageId: "message-1",
      questionId: "question-1",
      selectedOptions: [],
      customInput: "  其他环境  ",
    })).toMatchObject({
      selectedOptions: [],
      customInput: "其他环境",
    })

    expect(() => userInputAnswerParamsSchema.parse({
      conversationId: "conversation-1",
      messageId: "message-1",
      questionId: "question-1",
      selectedOptions: ["测试环境"],
      customInput: "其他环境",
    })).toThrow()
  })
})
