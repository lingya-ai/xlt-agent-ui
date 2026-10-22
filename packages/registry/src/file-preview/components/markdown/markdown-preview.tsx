'use client'

// 简化的错误边界
import {Component, lazy, type ReactNode, Suspense, useEffect, useState} from 'react'
import {cn} from '../../../ui/lib/utils'
import {ScrollArea} from '../../../ui/components/scroll-area'
import type {PreviewerProps} from '../../types'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export interface MarkdownPreviewProps extends PreviewerProps {
}

const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024 // 2MB

/**
 * Markdown 预览器（基于 streamdown，peerDependency）
 */
export function MarkdownPreview({source, config, className}: MarkdownPreviewProps) {
  const [markdown, setMarkdown] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const previewState = usePreviewControls({zoom: config.initialZoom ?? 1})

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(undefined)

    Promise.resolve()
      .then(() => {
        if (source.byteLength > MAX_MARKDOWN_BYTES) {
          return (
            new TextDecoder('utf-8', {fatal: false}).decode(
              new Uint8Array(source, 0, MAX_MARKDOWN_BYTES),
            ) + '\n\n... (文件过大，仅显示前 2MB 内容)'
          )
        }
        return new TextDecoder('utf-8', {fatal: false}).decode(new Uint8Array(source))
      })
      .then((text) => {
        if (!cancelled) {
          setMarkdown(text)
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
        <div
          className="markdown-preview p-6 max-w-4xl mx-auto"
          style={{
            fontSize: `${Math.round(15 * previewState.zoom)}px`,
            lineHeight: 1.7,
          }}
        >
          <StreamdownMarkdown content={markdown ?? ''} onError={setError}/>
        </div>
      </ScrollArea>
    </div>
  )
}

// 动态加载 streamdown（peerDependency），避免影响未使用 markdown 预览的页面
const Streamdown = lazy(async () => {
  const {Streamdown: Component} = await import('streamdown')
  return {default: Component}
})

function StreamdownMarkdown({
                              content,
                              onError,
                            }: {
  content: string
  onError: (err: Error) => void
}) {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary onError={onError}>
        <Streamdown>{content}</Streamdown>
      </ErrorBoundary>
    </Suspense>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  onError: (err: Error) => void
}

class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  { hasError: boolean }
> {
  state = {hasError: false}

  static getDerivedStateFromError() {
    return {hasError: true}
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}
