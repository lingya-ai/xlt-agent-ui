'use client'

import {renderAsync} from 'docx-preview'
import {useEffect, useRef, useState} from 'react'
import {cn} from '../../../ui/lib/utils'
import {ScrollArea} from '../../../ui/components/scroll-area'
import type {PreviewerProps} from '../../types'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export type DocxPreviewProps = PreviewerProps

/**
 * Word (.docx) 预览器（基于 docx-preview）
 *
 * 注意：容器 div 必须始终渲染，否则 containerRef.current 在 loading 时为 null，
 * useEffect 第一行 if 会直接 return，导致 renderAsync 永不执行、loading 永不结束。
 */
export function DocxPreview({source, config, onError, className}: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const previewState = usePreviewControls({zoom: config.initialZoom ?? 1})

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      console.warn('[DocxPreview] container not mounted')
      return
    }
    let cancelled = false

    setLoading(true)
    setError(undefined)
    container.innerHTML = ''

    const blob = new Blob([source])
    renderAsync(blob, container, undefined, {
      className: 'docx-preview-content',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      experimental: true,
      useBase64URL: true,
    })
      .then(() => {
        if (!cancelled) setLoading(false)
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          const nextError = caughtError instanceof Error ? caughtError : new Error(String(caughtError))
          setError(nextError)
          setLoading(false)
          onError?.(nextError)
        }
      })

    return () => {
      cancelled = true
      container.innerHTML = ''
    }
  }, [onError, source])

  if (error) {
    return <PreviewError error={error} variant="parse" className={className}/>
  }

  return (
    <div className={cn('relative flex flex-col min-h-0', className)}>
      <ScrollArea className="flex-1 min-h-0 bg-muted/20">
        <div
          className="flex justify-center p-4"
          style={{
            transform: `scale(${previewState.zoom})`,
            transformOrigin: 'top center',
          }}
        >
          {/* 容器必须始终渲染，否则 ref 不挂载、renderAsync 永不执行 */}
          <div
            ref={containerRef}
            className="docx-preview-container bg-white shadow-md"
            style={{minWidth: '600px'}}
          />
        </div>
      </ScrollArea>
      {loading ? (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <PreviewLoading/>
        </div>
      ) : null}
    </div>
  )
}
