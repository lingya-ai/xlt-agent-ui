'use client'

import {useEffect, useState} from 'react'
import {cn} from '../../../ui/lib/utils'
import {ScrollArea} from '../../../ui/components/scroll-area'
import type {PreviewerProps} from '../../types'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export interface TextPreviewProps extends PreviewerProps {
}

const MAX_TEXT_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * 纯文本预览器（txt/log/csv 等）
 */
export function TextPreview({source, fileName, config, className}: TextPreviewProps) {
  const [content, setContent] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const previewState = usePreviewControls({zoom: config.initialZoom ?? 1})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)

    Promise.resolve()
      .then(() => {
        if (source.byteLength > MAX_TEXT_BYTES) {
          // 截断大文件
          return new TextDecoder('utf-8', {fatal: false}).decode(
            new Uint8Array(source, 0, MAX_TEXT_BYTES),
          ) + '\n\n... (文件过大，仅显示前 5MB 内容)'
        }
        return new TextDecoder('utf-8', {fatal: false}).decode(new Uint8Array(source))
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [source])

  if (loading) return <PreviewLoading className={className}/>
  if (error) return <PreviewError error={error} variant="parse" className={className}/>

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <ScrollArea className="flex-1 min-h-0 bg-background">
        <pre
          className="p-4 text-sm font-mono whitespace-pre-wrap wrap-break-word"
          style={{
            fontSize: `${Math.round(14 * previewState.zoom)}px`,
            lineHeight: 1.6,
          }}
        >
          {content}
        </pre>
      </ScrollArea>
      {/* 文件名仅供占位使用，避免未使用警告 */}
      <span className="hidden">{fileName}</span>
    </div>
  )
}
