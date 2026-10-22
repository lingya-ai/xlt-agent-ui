'use client'

import {useEffect, useState} from 'react'
import {Download, FileWarning} from 'lucide-react'
import {useAgentMessages} from '../../../i18n/runtime'
import type {BundledLanguage} from 'shiki'
import {Button} from '../../../ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../ui/components/empty'
import {ScrollArea} from '../../../ui/components/scroll-area'
import {cn} from '../../../ui/lib/utils'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import type {PreviewerProps} from '../../types'
import {extractExtension} from '../../utils/detect-file-kind'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export type CodePreviewProps = PreviewerProps

interface ShikiToken {
  content: string
  color?: string
  bgColor?: string
  fontStyle?: number
}

interface ShikiResult {
  tokens: ShikiToken[][]
  fg: string
  bg: string
}

const MAX_CODE_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_JSON_BYTES = 100 * 1024 // 100KB

const EXT_TO_LANG: Record<string, BundledLanguage> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  mjs: 'javascript', cjs: 'javascript',
  json: 'json', json5: 'json', jsonc: 'json',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'sass',
  less: 'less', vue: 'vue', svelte: 'svelte', astro: 'astro',
  py: 'python', rb: 'ruby', php: 'php', java: 'java',
  kt: 'kotlin', kotlin: 'kotlin', swift: 'swift',
  go: 'go', rs: 'rust', rust: 'rust', c: 'c', cpp: 'cpp',
  cs: 'csharp', scala: 'scala', dart: 'dart', lua: 'lua',
  r: 'r', sql: 'sql',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', ini: 'ini',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  dockerfile: 'docker',
  xml: 'xml', svg: 'xml',
}

/**
 * 代码预览器（基于 shiki 语法高亮）
 *
 * shiki 作为 peerDependency，使用动态 import 避免影响未使用代码预览的页面。
 * JSON 文件在高亮前格式化；超过 100KB 时不再解析和渲染，避免阻塞页面主线程。
 */
export function CodePreview({source, fileName, mimeType, config, className, onDownload}: CodePreviewProps) {
  const t = useAgentMessages('code-preview')
  const [highlighted, setHighlighted] = useState<ShikiResult>()
  const [rawText, setRawText] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const previewState = usePreviewControls({zoom: config.initialZoom ?? 1})
  const extension = extractExtension(fileName)
  const normalizedMimeType = mimeType?.split(';', 1)[0]?.trim().toLowerCase()
  const isJson = extension === 'json' || normalizedMimeType === 'application/json'
  const isJsonTooLarge = isJson && source.byteLength > MAX_JSON_BYTES

  useEffect(() => {
    let cancelled = false

    setHighlighted(undefined)
    setRawText(undefined)
    setLoading(true)
    setError(undefined)

    if (isJsonTooLarge) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    try {
      const decodedText =
        source.byteLength > MAX_CODE_BYTES
          ? new TextDecoder('utf-8', {fatal: false}).decode(
          new Uint8Array(source, 0, MAX_CODE_BYTES),
        ) + '\n\n... (文件过大，仅显示前 2MB 内容)'
          : new TextDecoder('utf-8', {fatal: false}).decode(new Uint8Array(source))
      const text = isJson
        ? JSON.stringify(JSON.parse(decodedText), null, 2)
        : decodedText

      setRawText(text)

      // 动态导入 shiki（peerDependency）
      import('shiki')
        .then(async ({createHighlighter}) => {
          if (cancelled) return
          // 未知扩展名 fallback 到 typescript（语法宽泛，对任意代码兼容）
          const lang: BundledLanguage = (extension && EXT_TO_LANG[extension]) || 'typescript'
          try {
            const highlighter = await createHighlighter({
              themes: ['github-light', 'github-dark'],
              langs: [lang],
            })
            if (cancelled) return
            const result = highlighter.codeToTokens(text, {
              lang,
              themes: {light: 'github-light', dark: 'github-dark'},
            })
            if (cancelled) return
            setHighlighted({
              tokens: result.tokens as unknown as ShikiToken[][],
              fg: result.fg ?? 'inherit',
              bg: result.bg ?? 'transparent',
            })
            setLoading(false)
          } catch (caughtError: unknown) {
            if (cancelled) return
            // 高亮失败回退到纯文本
            setLoading(false)
            console.warn('Code highlight failed:', caughtError)
          }
        })
        .catch((caughtError: unknown) => {
          if (cancelled) return
          setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)))
          setLoading(false)
        })
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)))
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [extension, isJson, isJsonTooLarge, source])

  if (isJsonTooLarge) {
    return (
      <Empty className={cn('h-full rounded-none border-0 bg-muted/30', className)}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileWarning/>
          </EmptyMedia>
          <EmptyTitle>{t.jsonTooLargeTitle}</EmptyTitle>
          <EmptyDescription>{t.jsonTooLargeDescription}</EmptyDescription>
        </EmptyHeader>
        {onDownload ? (
          <EmptyContent>
            <Button type="button" size="sm" onClick={onDownload}>
              <Download data-icon="inline-start"/>
              {t.download}
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    )
  }

  if (loading && !rawText) return <PreviewLoading className={className}/>
  if (error) return <PreviewError error={error} variant="parse" className={className}/>

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <ScrollArea className="flex-1 min-h-0 bg-background">
        <pre
          className="dark:bg-(--shiki-dark-bg)! dark:text-(--shiki-dark)! p-4 m-0"
          style={{
            backgroundColor: highlighted?.bg ?? 'transparent',
            color: highlighted?.fg ?? 'inherit',
            fontSize: `${Math.round(13 * previewState.zoom)}px`,
            lineHeight: 1.6,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          <code className="font-mono">
            {(highlighted?.tokens ?? parsePlain(rawText ?? '')).map((line, lineIdx) => (
              <span key={lineIdx} className="block">
                {line.length === 0 ? (
                  '\n'
                ) : (
                  line.map((token, tokenIdx) => (
                    <span
                      key={tokenIdx}
                      style={{
                        color: token.color,
                        backgroundColor: token.bgColor,
                      }}
                    >
                      {token.content}
                    </span>
                  ))
                )}
              </span>
            ))}
          </code>
        </pre>
      </ScrollArea>
    </div>
  )
}

function parsePlain(text: string): ShikiToken[][] {
  return text.split('\n').map((line) =>
    line === ''
      ? []
      : [
        {
          content: line,
          color: 'inherit',
        },
      ],
  )
}
