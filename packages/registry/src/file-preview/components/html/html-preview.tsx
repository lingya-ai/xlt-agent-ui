'use client'

import {useMemo} from 'react'
import {cn} from '../../../ui/lib/utils'
import type {PreviewerProps} from '../../types'
import {PreviewError} from '../preview-error'

export type HtmlPreviewProps = PreviewerProps

const HTML_PREVIEW_CSP = [
  `default-src 'none'`,
  `base-uri 'none'`,
  `connect-src 'none'`,
  'font-src data:',
  `form-action 'none'`,
  `frame-src 'none'`,
  'img-src data: blob:',
  'media-src data: blob:',
  `object-src 'none'`,
  `script-src 'none'`,
  `style-src 'unsafe-inline'`,
].join('; ')

/**
 * HTML 文件预览器。
 *
 * 通过不授予任何权限的 sandbox iframe 渲染 HTML，并使用 CSP 禁止脚本、网络请求和表单提交，
 * 防止预览不受信任文件时影响宿主应用。
 */
export function HtmlPreview({source, fileName, className}: HtmlPreviewProps) {
  const {content, error} = useMemo(() => {
    try {
      const html = new TextDecoder('utf-8', {fatal: false}).decode(new Uint8Array(source))
      return {
        content: `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_CSP}">${html}`,
      }
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }, [source])
  if (error) return <PreviewError error={error} variant="parse" className={className}/>

  return (
    <div className={cn('flex min-h-0 flex-col bg-muted/20', className)}>
      <iframe
        title={fileName ?? 'HTML'}
        srcDoc={content}
        sandbox=""
        referrerPolicy="no-referrer"
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  )
}
