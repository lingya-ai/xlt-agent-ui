'use client'

import {useCallback, useEffect, useState} from 'react'
import {cn} from '../../ui/lib/utils'
import {DEFAULT_TOOLBAR_CONFIG} from '../constants/file-type'
import {PreviewControlsProvider} from '../contexts/preview-controls-context'
import {PreviewerProvider} from '../contexts/previewer-context'
import {useFileSource} from '../hooks/use-file-source'
import {usePreviewState} from '../hooks/use-preview-state'
import type {
  FileSource,
  PreviewConfig,
  PreviewerKind,
  ToolbarConfig,
} from '../types'
import {detectFileKind, extractFileName, resolveFileKind} from '../utils/detect-file-kind'
import {downloadFile} from '../utils/download-file'
import {validateDocxArchive, validatePptxArchive} from '../utils/validate-file-buffer'
import {PreviewError} from './preview-error'
import {PreviewRouter} from './preview-router'
import {PreviewToolbar} from './preview-toolbar'

export type {FilePreviewProps} from '../props'
import type {FilePreviewProps} from '../props'

/**
 * 统一文件预览入口组件。
 *
 * 预览内容与工具栏共享同一份缩放、旋转、分页状态。默认工具栏固定在预览底部；
 * 调用方可传入 toolbarContainer，将同一套控制按钮放入 Sheet、Dialog 等外部标题栏。
 */
export function FilePreview({
  src,
  fileName,
  fileKind = 'auto',
  mimeType,
  requestCache,
  toolbar,
  previewers,
  toolbarContainer,
  fullscreenTarget,
  onError,
  onDownload,
  className,
}: FilePreviewProps) {
  const inferredName = fileName ?? extractFileName(src)
  const inferredMimeType = mimeType ?? extractMimeType(src)
  const detectedKind = detectFileKind(inferredName, inferredMimeType, previewers)
  const resolvedKind: PreviewerKind = resolveFileKind(fileKind, detectedKind)
  const validate = resolvedKind === 'docx'
    ? validateDocxArchive
    : resolvedKind === 'pptx'
      ? validatePptxArchive
      : undefined
  const {buffer, error, reload} = useFileSource(src, {cache: requestCache, validate})
  const [previewRoot, setPreviewRoot] = useState<HTMLDivElement | null>(null)
  const previewState = usePreviewState({zoom: 1})

  useEffect(() => {
    if (error) onError?.(error)
  }, [error, onError])

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload(src)
      return
    }
    void downloadFile(src, inferredName)
  }, [inferredName, onDownload, src])

  const setPreviewRootRef = useCallback((node: HTMLDivElement | null) => {
    setPreviewRoot(node)
  }, [])

  if (error) {
    return <PreviewError error={error} variant="load" onRetry={reload} className={className}/>
  }

  if (!buffer) {
    return <div className={cn('flex min-h-[120px]', className)}/>
  }

  const config: PreviewConfig = {
    initialZoom: 1,
    toolbar: resolveToolbarConfig(resolvedKind, toolbar),
  }

  return (
    <PreviewerProvider previewers={previewers}>
      <PreviewControlsProvider state={previewState}>
        <div ref={setPreviewRootRef} className={cn('flex min-h-0 flex-col', className)}>
          <PreviewRouter
            kind={resolvedKind}
            source={buffer}
            fileName={inferredName}
            mimeType={inferredMimeType}
            config={config}
            onDownload={handleDownload}
            onError={onError}
            className="min-h-0 flex-1"
          />
          <PreviewToolbar
            config={config.toolbar ?? {}}
            state={previewState}
            showPagination={resolvedKind === 'pdf' || resolvedKind === 'pptx'}
            onDownload={handleDownload}
            container={toolbarContainer}
            fullscreenTarget={fullscreenTarget ?? previewRoot}
            placement={toolbarContainer ? 'header' : 'bottom'}
          />
        </div>
      </PreviewControlsProvider>
    </PreviewerProvider>
  )
}

/** 从二进制文件源读取用于自动识别格式的 MIME 类型。 */
function extractMimeType(src: FileSource): string | undefined {
  if (typeof src === 'object' && 'data' in src) return src.mimeType
  return undefined
}

/** 根据文件类型隐藏没有实际效果的通用控制按钮。 */
function resolveToolbarConfig(kind: PreviewerKind, toolbar?: Partial<ToolbarConfig>): ToolbarConfig {
  const config: ToolbarConfig = {...DEFAULT_TOOLBAR_CONFIG, ...toolbar}

  switch (kind) {
    case 'pdf':
    case 'pptx':
    case 'docx':
    case 'excel':
    case 'markdown':
    case 'text':
    case 'code':
      return {...config, rotate: false}
    case 'html':
      return {...config, zoom: false, rotate: false}
    case 'audio':
      return {...config, zoom: false, rotate: false, fullscreen: false}
    case 'video':
      return {...config, zoom: false, rotate: false}
    case 'unsupported':
      return {...config, zoom: false, rotate: false, fullscreen: false}
    default:
      return config
  }
}
