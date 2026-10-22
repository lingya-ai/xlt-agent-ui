'use client';

import {useCallback} from "react";
import {useAgentMessages} from "../../../i18n/runtime";
import {type Inputs, type PromptVariable, VariableTypeEnum} from "./types";
import {toast} from "sonner";

/**
 * 检查提示变量
 */
export const useCheckPromptVariables = () => {
  const t = useAgentMessages("use-check-prompt-variables")

  return useCallback((promptVariablesConfig: {
    inputs: Inputs
    promptVariables: PromptVariable[]
  }) => {

    const {promptVariables, inputs,} = promptVariablesConfig

    let hasEmptyInput = ''
    const requiredVars = promptVariables.filter(({key, name, type}) => {
      if (type !== VariableTypeEnum.String) return false
      return (!key || !key.trim()) || (!name || !name.trim())
    })

    if (requiredVars?.length) {
      requiredVars.forEach(({key, name}) => {
        if (hasEmptyInput)
          return

        if (!inputs[key])
          hasEmptyInput = name
      })
    }

    if (hasEmptyInput) {
      toast.error(t.requiredField({field: hasEmptyInput}))
      return false
    }
  }, [])
}

// 匹配 {variable} 格式
export const promptVariableRegex = /\{([^}]+)}/g

/**
 * 将提示变量替换为具体的值
 * @param str
 * @param promptVariables
 * @param inputs
 */
export function replaceStringWithValues(str: string, promptVariables: PromptVariable[], inputs: Record<string, unknown>) {
  return str.replace(promptVariableRegex, (match, key) => {
    const name = inputs[key]
    if (name) {
      return String(name)
    }

    const valueObj: PromptVariable | undefined = promptVariables.find(v => v.key === key)
    return valueObj ? `{{${valueObj.name}}}` : match
  })
}
