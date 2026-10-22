'use client'

import {createContext, useContext} from 'react'
import type {PropsWithChildren} from 'react'
import {usePreviewState, type PreviewState, type UsePreviewStateResult} from '../hooks/use-preview-state'

const PreviewControlsContext = createContext<UsePreviewStateResult | null>(null)

export interface PreviewControlsProviderProps extends PropsWithChildren {
  /** 当前文件预览实例共享的缩放、旋转与分页状态。 */
  state: UsePreviewStateResult
}

/** 为同一个文件预览实例的工具栏与内容预览器共享控制状态。 */
export function PreviewControlsProvider({state, children}: PreviewControlsProviderProps) {
  return <PreviewControlsContext.Provider value={state}>{children}</PreviewControlsContext.Provider>
}

/**
 * 获取当前预览器的控制状态。
 *
 * FilePreview 内部会提供共享状态；为兼容直接使用已导出预览器的场景，缺少 Provider 时自动创建局部状态。
 */
export function usePreviewControls(initial?: Partial<PreviewState>): UsePreviewStateResult {
  const context = useContext(PreviewControlsContext)
  const fallbackState = usePreviewState(initial)
  return context ?? fallbackState
}