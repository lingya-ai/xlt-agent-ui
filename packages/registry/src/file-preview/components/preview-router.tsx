'use client'

import type {PreviewerKind, PreviewerProps} from '../types'
import {usePreviewer} from '../contexts/previewer-context'
import {resolvePreviewer} from '../registry/previewer-registry'
import {PdfPreview} from './pdf/pdf-preview'
import {PptxPreview} from './pptx/pptx-preview'
import {DocxPreview} from './docx/docx-preview'
import {ExcelPreview} from './excel/excel-preview'
import {ImagePreview} from './image/image-preview'
import {TextPreview} from './text/text-preview'
import {CodePreview} from './text/code-preview'
import {MarkdownPreview} from './markdown/markdown-preview'
import {HtmlPreview} from './html/html-preview'
import {VideoPreview} from './video/video-preview'
import {AudioPreview} from './audio/audio-preview'
import {PreviewUnsupported} from './preview-unsupported'

export interface PreviewRouterProps extends PreviewerProps {
  kind: PreviewerKind
}

/**
 * 预览器路由分发（优先使用已注册预览器，再按内置 FileKind 路由）
 *
 * 注：使用直接 import 而非 React.lazy，避免 workspace 包内 dynamic import
 * 在 Turbopack 中可能不 resolve 导致一直停留在 Suspense fallback 的问题。
 * 包体积优化由 Next.js 的 code splitting 在路由层自动完成。
 */
export function PreviewRouter({kind, ...rest}: PreviewRouterProps) {
  console.log('[PreviewRouter] route', {kind, fileName: rest.fileName, byteLength: rest.source.byteLength})
  const contextualPreviewer = usePreviewer(kind)
  const registeredPreviewer = contextualPreviewer ?? resolvePreviewer(kind)
  if (registeredPreviewer) {
    const RegisteredPreviewer = registeredPreviewer.Component
    return <RegisteredPreviewer {...rest} />
  }

  switch (kind) {
    case 'pdf':
      return <PdfPreview {...rest} />
    case 'pptx':
      return <PptxPreview {...rest} />
    case 'docx':
      return <DocxPreview {...rest} />
    case 'excel':
      return <ExcelPreview {...rest} />
    case 'image':
      return <ImagePreview {...rest} />
    case 'text':
      return <TextPreview {...rest} />
    case 'code':
      return <CodePreview {...rest} />
    case 'markdown':
      return <MarkdownPreview {...rest} />
    case 'html':
      return <HtmlPreview {...rest} />
    case 'video':
      return <VideoPreview {...rest} />
    case 'audio':
      return <AudioPreview {...rest} />
    case 'unsupported':
    default:
      console.log('[PreviewRouter] -> unsupported')
      return (
        <PreviewUnsupported
          fileName={rest.fileName}
          onDownload={rest.onDownload}
          className={rest.className}
          showInlineDownload={false}
        />
      )
  }
}
