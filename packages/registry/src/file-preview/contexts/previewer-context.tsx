'use client'

import {createContext, useContext} from 'react'
import type {PropsWithChildren} from 'react'
import type {PreviewerDefinition, PreviewerKind} from '../types'
import {resolvePreviewerFromDefinitions} from '../utils/resolve-previewer'

const EMPTY_PREVIEWERS: readonly PreviewerDefinition[] = []

const PreviewerContext = createContext<readonly PreviewerDefinition[]>(EMPTY_PREVIEWERS)

export interface PreviewerProviderProps extends PropsWithChildren {
  /** 当前 FilePreview 实例可用的自定义预览器。 */
  previewers?: readonly PreviewerDefinition[]
}

/** 为当前文件预览实例提供局部自定义预览器。 */
export function PreviewerProvider({previewers, children}: PreviewerProviderProps) {
  return (
    <PreviewerContext.Provider value={previewers ?? EMPTY_PREVIEWERS}>
      {children}
    </PreviewerContext.Provider>
  )
}

/** 获取当前 FilePreview 实例中指定类别的自定义预览器。 */
export function usePreviewer(kind: PreviewerKind): PreviewerDefinition | undefined {
  return resolvePreviewerFromDefinitions(useContext(PreviewerContext), kind)
}
