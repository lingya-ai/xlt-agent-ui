'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {cn} from '../../../ui/lib/utils'
import {ScrollArea} from '../../../ui/components/scroll-area'
import type {PreviewerProps} from '../../types'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'
import {pdfjs} from './pdf-worker'

export interface PdfPreviewProps extends PreviewerProps {
}

interface RenderedPage {
  pageNumber: number
  /** 渲染后的 canvas dataURL */
  dataUrl: string
  width: number
  height: number
}

/**
 * PDF 预览器（基于 pdf.js）
 */
export function PdfPreview({source, config, className}: PdfPreviewProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy>()
  const [pages, setPages] = useState<RenderedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()

  const previewState = usePreviewControls({zoom: config.initialZoom ?? 1.2})
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement | null | undefined>(null)

  // 加载文档
  useEffect(() => {
    let cancelled = false
    let doc: pdfjs.PDFDocumentProxy | undefined

    setLoading(true)
    setError(undefined)
    setPages([])

    // PDF.js 会将传入的底层 ArrayBuffer 转移给 Worker，因此必须传入副本。
    // 否则 React 开发模式重复执行 effect 时会复用已 detached 的 buffer，导致解析失败。
    const task = pdfjs.getDocument({data: source.slice(0)})
    task.promise
      .then((loaded) => {
        if (cancelled) return
        doc = loaded
        setPdfDoc(loaded)
        previewState.setTotalPages(loaded.numPages)
        previewState.setCurrentPage(1)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      void doc?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  // 渲染页面
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false

    setLoading(true)
    setError(undefined)

    const renderAll = async () => {
      const result: RenderedPage[] = []
      // 大文档限制渲染范围，避免卡死浏览器
      const maxPages = Math.min(pdfDoc.numPages, 50)
      const scale = previewState.zoom

      for (let i = 1; i <= maxPages; i++) {
        if (cancelled) return
        try {
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({scale})
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            if (!cancelled) {
              setError(new Error('Canvas 2D context 不可用'))
            }
            return
          }
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          await page.render({canvasContext: ctx, viewport}).promise
          result.push({
            pageNumber: i,
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            width: canvas.width,
            height: canvas.height,
          })
        } catch (err: unknown) {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)))
          }
          return
        }
      }
      if (!cancelled) {
        setPages(result)
        setLoading(false)
      }
    }

    void renderAll()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, previewState.zoom])

  // 滚动同步当前页
  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const children = Array.from(viewport.querySelectorAll('[data-page]')) as HTMLElement[]
    const scrollTop = viewport.scrollTop
    const containerHeight = viewport.clientHeight
    const center = scrollTop + containerHeight / 2
    for (let i = 0; i < children.length; i++) {
      const top = children[i]!.offsetTop
      const bottom = top + children[i]!.offsetHeight
      if (center >= top && center < bottom) {
        previewState.setCurrentPage(i + 1)
        break
      }
    }
  }, [])

  // ScrollArea 的 viewport 通过 ref 读取（Radix Viewport 才是真正滚动容器）
  const setScrollAreaRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node
    const viewport = node?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (viewportRef.current !== viewport) {
      if (viewportRef.current) {
        viewportRef.current.removeEventListener('scroll', handleScroll)
      }
      viewportRef.current = viewport
      if (viewport) {
        viewport.addEventListener('scroll', handleScroll, {passive: true})
      }
    }
  }, [handleScroll])

  useEffect(() => {
    return () => {
      if (viewportRef.current) {
        viewportRef.current.removeEventListener('scroll', handleScroll)
      }
    }
  }, [handleScroll])

  // 跳转到指定页
  useEffect(() => {
    if (!containerRef.current) return
    const target = containerRef.current.querySelector<HTMLElement>(`[data-page="${previewState.currentPage}"]`)
    if (target) {
      target.scrollIntoView({behavior: 'smooth', block: 'start'})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewState.currentPage])

  if (loading && pages.length === 0) {
    console.log('[PdfPreview] -> PreviewLoading', {loading, pages: pages.length, hasDoc: Boolean(pdfDoc)})
    return <PreviewLoading className={className}/>
  }
  if (error) {
    console.log('[PdfPreview] -> PreviewError', {error})
    return <PreviewError error={error} variant="parse" className={className}/>
  }

  console.log('[PdfPreview] rendered pages', {count: pages.length, totalPages: pdfDoc?.numPages})

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <ScrollArea
        ref={setScrollAreaRef}
        className="flex-1 min-h-0 bg-muted/20"
      >
        <div
          className="flex flex-col items-center gap-3 p-4"
        >
          {pages.map((page) => (
            <img
              key={page.pageNumber}
              data-page={page.pageNumber}
              src={page.dataUrl}
              alt={`第 ${page.pageNumber} 页`}
              className="shadow-md bg-white max-w-full"
              style={{width: 'auto', maxWidth: '100%'}}
              draggable={false}
            />
          ))}
          {pdfDoc && pdfDoc.numPages > 50 ? (
            <p className="text-xs text-muted-foreground py-4">
              仅渲染前 50 页（共 {pdfDoc.numPages} 页），如需查看完整内容请下载
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
