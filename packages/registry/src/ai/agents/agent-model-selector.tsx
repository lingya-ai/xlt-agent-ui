'use client'

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useAgentMessages} from '../../i18n/runtime'

import {Button} from '../../ui/components/button'
import {cn} from '../../ui/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../ui/components/command'
import {Popover, PopoverContent, PopoverTrigger} from '../../ui/components/popover'


import {getDefaultModelSelectionKey} from "../hooks/use-chat/use-agents-config"
import {useAiChatConfigContext} from "./config"

// ============ Types ============

/** 级联选择器选项 */
export interface CascaderOption {
  /** 选项唯一标识 */
  value: string
  /** 选项显示文本 */
  label: string
  /** 选项描述 */
  description?: string
  /** 制造商/来源，显示在选项右侧 */
  maker?: string
  /** 是否支持思考模式（用于回传给父组件） */
  thinkingMode?: boolean
}

/** 级联选择器分组 */
export interface CascaderGroup {
  /** 分组唯一标识 */
  id: string | number
  /** 分组显示文本 */
  label: string
  /** 分组下的选项列表 */
  options: CascaderOption[]
}

/** 已选中的模型信息，回传给父组件 */
export interface SelectedModel {
  /** 密钥组 ID */
  keyGroupId: number
  /** 模型名称 */
  model: string
  /** 是否支持思考模式 */
  thinkingMode: boolean
}

/**
 * 模型选择器组件属性
 *
 * 从 AiChatConfigContext 读取模型数据，自包含处理数据映射和状态管理。
 * 用户在选项步骤点击最终选项时，onModelChange 回调触发。
 */
export interface AgentModelSelectorProps {
  /** 模型变更回调，通知父组件当前选中的模型信息 */
  onModelChange?: (selected: SelectedModel | undefined) => void
  /** 触发器占位文本 */
  placeholder?: string
  disabled?: boolean
  className?: string
}

type Step = 'group' | 'option'

/**
 * 模型选择器 — 两步级联选择（选密钥组 → 选模型）
 *
 * 从 AiChatConfigContext 获取 AgentsConfig.modelConfig 中的模型数据，
 * 自包含处理数据映射、状态管理和默认值初始化。
 *
 * 交互流程：选择密钥组 → 选择模型。最终选择模型时触发 onModelChange；
 * 中间浏览（切换密钥组、返回）不会影响外部状态。
 */
export function AgentModelSelector({
  onModelChange,
  placeholder,
  disabled,
  className,
}: AgentModelSelectorProps): React.ReactElement | null {
  const {config} = useAiChatConfigContext()
  const t = useAgentMessages('agent-model-selector')

  // ModelKeyGroup[] → CascaderGroup[]
  const groups: CascaderGroup[] = useMemo(() =>
    config.modelConfig.modelKeyGroups.map((group) => ({
      id: group.keyGroupId,
      label: group.keyGroupName,
      options: group.models.map((m) => ({
        value: m.modelName,
        label: m.modelLabel || m.modelName,
        description: m.modelDescription,
        maker: m.maker,
        thinkingMode: m.thinkingMode,
      })),
    })),
    [config],
  )

  // 所有分组下的模型总数
  const totalOptionsCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.options.length, 0),
    [groups],
  )
  // 没有可用模型时不展示；只有一个模型时自动选中并隐藏选择器
  const shouldHideSelector = totalOptionsCount <= 1

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('group')
  const [activeGroupId, setActiveGroupId] = useState<string | number | undefined>()
  const [selectedGroupId, setSelectedGroupId] = useState<string | number | undefined>()
  const [selectedModelValue, setSelectedModelValue] = useState<string | undefined>()

  // 有效默认配置发生变化时重新初始化；普通列表刷新不会覆盖用户手动选择。
  const defaultModelSelectionKey = getDefaultModelSelectionKey(config.modelConfig.defaultModel)
  const initializedDefaultModelRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (initializedDefaultModelRef.current === defaultModelSelectionKey) return
    if (groups.length === 0) {
      setSelectedGroupId(undefined)
      setSelectedModelValue(undefined)
      onModelChange?.(undefined)
      initializedDefaultModelRef.current = defaultModelSelectionKey
      return
    }

    const {defaultModel: defaultCfg} = config.modelConfig
    let targetGroup = groups[0]!
    let targetOption = targetGroup.options[0]

    if (defaultCfg) {
      const matchedGroup = groups.find((g) => g.id === defaultCfg.keyGroupId)
      if (matchedGroup?.options.length) {
        targetGroup = matchedGroup
        // 优先精确匹配 defaultCfg.model，匹配不到时回退到该组的第一个模型
        targetOption =
          matchedGroup.options.find((o) => o.value === defaultCfg.model) ??
          matchedGroup.options[0]!
      }
    }

    if (!targetOption) return

    setSelectedGroupId(targetGroup.id)
    setSelectedModelValue(targetOption.value)
    onModelChange?.({
      keyGroupId: Number(targetGroup.id),
      model: targetOption.value,
      thinkingMode: Boolean(targetOption.thinkingMode),
    })
    initializedDefaultModelRef.current = defaultModelSelectionKey
  }, [defaultModelSelectionKey, groups, config.modelConfig.defaultModel, onModelChange])

  // 当前活跃分组（内部浏览用）
  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId),
    [groups, activeGroupId],
  )

  // 已确认选中的分组
  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId),
    [groups, selectedGroupId],
  )

  // 已确认选中的选项
  const selectedOption = useMemo(
    () => selectedGroup?.options.find((o) => o.value === selectedModelValue),
    [selectedGroup, selectedModelValue],
  )

  // 触发器文本：仅显示模型名称
  const triggerText = useMemo(() => {
    if (selectedOption) return selectedOption.label
    return placeholder ?? t.placeholder.value
  }, [selectedOption, placeholder, t])

  // Popover 开关：打开时初始化步骤
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen) {
        setStep(selectedGroupId ? 'option' : 'group')
        setActiveGroupId(selectedGroupId)
      }
    },
    [selectedGroupId],
  )

  // 选择分组 → 进入选项步骤
  const handleSelectGroup = useCallback((id: string | number) => {
    setActiveGroupId(id)
    setStep('option')
  }, [])

  // 选择选项 → 提交选中状态
  const handleSelectOption = useCallback(
    (option: CascaderOption) => {
      setSelectedGroupId(activeGroupId)
      setSelectedModelValue(option.value)
      onModelChange?.({
        keyGroupId: Number(activeGroupId),
        model: option.value,
        thinkingMode: Boolean(option.thinkingMode),
      })
      setOpen(false)
    },
    [activeGroupId, onModelChange],
  )

  // 返回分组列表
  const handleBack = useCallback(() => setStep('group'), [])

  // 空模型列表不展示选择器；单模型仍通过上面的初始化逻辑回传选中值
  if (shouldHideSelector) return null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'min-w-0 max-w-40 shrink-0 justify-between px-2 font-normal text-xs',
            'text-muted-foreground shadow-none hover:bg-muted hover:text-foreground',
            className,
          )}
        >
          <span className="truncate">{triggerText}</span>
          <svg className="ml-1 size-3 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        {step === 'group' ? (
          <Command shouldFilter>
            <CommandInput placeholder={t.searchMaker.value}/>
            <CommandList>
              {groups.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs text-muted-foreground">{t.noMakers}</span>
                </div>
              ) : (
                <CommandGroup>
                  {groups.map((g) => (
                    <CommandItem
                      key={g.id}
                      value={g.label}
                      onSelect={() => handleSelectGroup(g.id)}
                      className="text-xs"
                    >
                      <span className="truncate">{g.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        ) : (
          <div className="flex flex-col">
            {/* 顶栏：返回 + 分组名称 */}
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleBack}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </Button>
              <span className="text-xs font-medium truncate">{activeGroup?.label ?? ''}</span>
            </div>
            {/* 选项列表 */}
            {(activeGroup?.options ?? []).length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <span className="text-xs text-muted-foreground">{t.noModels}</span>
              </div>
            ) : (
              <Command shouldFilter>
                <CommandInput placeholder={t.searchModel.value}/>
                <CommandList>
                  <CommandEmpty>
                    <span className="text-xs">{t.noModels}</span>
                  </CommandEmpty>
                  <CommandGroup>
                    {activeGroup?.options.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={`${opt.value} ${opt.label ?? ''} ${opt.maker ?? ''}`}
                        onSelect={() => handleSelectOption(opt)}
                        className="text-xs"
                      >
                        <span className="truncate">{opt.label}</span>
                        {opt.maker && (
                          <span className="text-xs text-muted-foreground ml-auto shrink-0 pl-2">{opt.maker}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
