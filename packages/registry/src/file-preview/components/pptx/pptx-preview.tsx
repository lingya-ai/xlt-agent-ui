'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {PptxViewer} from '@file-viewer/pptx'
import {ScrollArea} from '../../../ui/components/scroll-area'
import {cn} from '../../../ui/lib/utils'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import type {PreviewerProps} from '../../types'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export type PptxPreviewProps = PreviewerProps

const PPTX_MIN_ZOOM = 0.25
const PPTX_MAX_ZOOM = 3

/**
 * PowerPoint (.pptx) 预览器。
 *
 * 文件完全在浏览器内解析。演示文稿按纵向连续布局渲染，媒体执行被禁用，
 * 并通过窗口化挂载控制长文档的 DOM 与内存占用。
 */
export function PptxPreview({source, config, onError, className}: PptxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PptxViewer | null>(null)
  const viewportRef = useRef<HTMLElement | null>(null)
  const setCurrentPageRef = useRef<ReturnType<typeof usePreviewControls>['setCurrentPage']>(() => undefined)
  const pageUpdatedByScrollRef = useRef<number | undefined>(undefined)
  const maxRenderedSlideRef = useRef(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const {
    currentPage,
    setCurrentPage,
    setTotalPages,
    setZoom,
    zoom,
  } = usePreviewControls({zoom: config.initialZoom ?? 1})
  const initialZoom = Math.min(1, Math.max(PPTX_MIN_ZOOM, config.initialZoom ?? 1))

  useEffect(() => {
    setCurrentPageRef.current = setCurrentPage
  }, [setCurrentPage])

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const slides = Array.from(
      viewport.querySelectorAll<HTMLElement>('[data-slide-number]'),
    )
    if (slides.length === 0) return

    const viewportRect = viewport.getBoundingClientRect()
    const viewportCenter = viewportRect.top + viewport.clientHeight / 2
    let nearestSlide: HTMLElement | undefined
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const slide of slides) {
      const rect = slide.getBoundingClientRect()
      const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestSlide = slide
      }
    }

    const page = Number(nearestSlide?.dataset.slideNumber)
    if (!Number.isInteger(page) || page < 1) return

    viewerRef.current?.ensureSlideRendered(page)
    pageUpdatedByScrollRef.current = page
    setCurrentPageRef.current(page)
  }, [])

  const setScrollAreaRef = useCallback((node: HTMLDivElement | null) => {
    const nextViewport = node?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null
    if (viewportRef.current === nextViewport) return

    viewportRef.current?.removeEventListener('scroll', handleScroll)
    viewportRef.current = nextViewport
    nextViewport?.addEventListener('scroll', handleScroll, {passive: true})
  }, [handleScroll])

  useEffect(() => {
    return () => {
      viewportRef.current?.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let viewer: PptxViewer | undefined
    let initialFitApplied = false
    const viewerTarget = container.ownerDocument.createElement('div')
    viewerTarget.className = 'min-w-0'
    const syncTotalPages = () => {
      if (cancelled) return
      const discoveredSlides = viewerTarget.querySelectorAll('[data-slide-number]').length
      setTotalPages(Math.max(1, discoveredSlides, viewer?.slideCount ?? 0, maxRenderedSlideRef.current))
    }
    const mutationObserver = new MutationObserver(syncTotalPages)

    setLoading(true)
    setError(undefined)
    maxRenderedSlideRef.current = 1
    setTotalPages(1)
    setCurrentPageRef.current(1)
    container.replaceChildren(viewerTarget)
    mutationObserver.observe(viewerTarget, {childList: true, subtree: true})

    const handleError = (caughtError: unknown) => {
      if (cancelled) return
      const nextError = toError(caughtError)
      setError(nextError)
      setLoading(false)
      onError?.(nextError)
    }

    void PptxViewer.open(source.slice(0), viewerTarget, {
      fitMode: 'none',
      zoomPercent: initialZoom * 100,
      lazySlides: true,
      lazyMedia: true,
      listOptions: {
        windowed: true,
        initialSlides: 3,
        batchSize: 4,
        overscanViewport: 1.5,
      },
      engineOptions: {
        slideMode: false,
        keyBoardShortCut: false,
        mediaProcess: false,
      },
      onSlideSize: (size) => {
        if (cancelled || initialFitApplied) return

        const slideWidth = Number(size.width)
        const viewportWidth = viewportRef.current?.clientWidth ?? container.clientWidth
        if (!Number.isFinite(slideWidth) || slideWidth <= 0 || viewportWidth <= 0) return

        initialFitApplied = true
        const availableWidth = Math.max(1, viewportWidth - 32)
        setZoom(Math.min(initialZoom, availableWidth / slideWidth))
      },
      onSlideRendered: (slideNumber) => {
        if (cancelled) return
        maxRenderedSlideRef.current = Math.max(maxRenderedSlideRef.current, slideNumber)
        syncTotalPages()
        setLoading(false)
      },
      onRenderComplete: () => {
        if (cancelled) return
        syncTotalPages()
        setLoading(false)
      },
      onError: handleError,
    })
      .then((nextViewer) => {
        if (cancelled) {
          nextViewer.destroy()
          return
        }
        viewer = nextViewer
        viewerRef.current = nextViewer
      })
      .catch(handleError)

    return () => {
      cancelled = true
      mutationObserver.disconnect()
      if (viewerRef.current === viewer) viewerRef.current = null
      viewer?.destroy()
      viewerTarget.remove()
    }
  }, [initialZoom, onError, setTotalPages, setZoom, source])

  useEffect(() => {
    const supportedZoom = Math.min(PPTX_MAX_ZOOM, Math.max(PPTX_MIN_ZOOM, zoom))
    if (supportedZoom !== zoom) {
      setZoom(supportedZoom)
      return
    }
    void viewerRef.current?.setZoom(supportedZoom * 100)
  }, [setZoom, zoom])

  useEffect(() => {
    if (pageUpdatedByScrollRef.current === currentPage) {
      pageUpdatedByScrollRef.current = undefined
      return
    }

    viewerRef.current?.ensureSlideRendered(currentPage)
    const viewport = viewportRef.current
    const target = viewport?.querySelector<HTMLElement>(
      `[data-slide-number="${currentPage}"]`,
    )
    target?.scrollIntoView({behavior: 'smooth', block: 'start'})
  }, [currentPage])

  return (
    <div className={cn('relative flex min-h-0 flex-col', className)}>
      <ScrollArea
        ref={setScrollAreaRef}
        horizontalScrollbar
        className="min-h-0 flex-1 bg-muted/20"
      >
        <div className="min-w-full p-4">
          <div ref={containerRef} className="min-w-0"/>
        </div>
      </ScrollArea>
      {error ? (
        <PreviewError error={error} variant="parse" className="absolute inset-0"/>
      ) : loading ? (
        <PreviewLoading className="absolute inset-0 bg-background/90"/>
      ) : null}
    </div>
  )
}

/** 将第三方解析异常收窄为统一 Error。 */
function toError(error: unknown): Error {
  if (error instanceof Error) return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') return new Error(message)
  }
  return new Error(String(error))
}
