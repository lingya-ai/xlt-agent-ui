'use client'

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {useAgentMessages} from '../../i18n/runtime'
import {createPortal} from 'react-dom'
import {type ReactNode, useCallback, useEffect, useState} from 'react'
import {Button} from '../../ui/components/button'
import {cn} from '../../ui/lib/utils'
import {Tooltip, TooltipContent, TooltipTrigger} from '../../ui/components/tooltip'
import type {ToolbarConfig} from '../types'
import type {UsePreviewStateResult} from '../hooks/use-preview-state'

export interface PreviewToolbarProps {
  config: Partial<ToolbarConfig>
  state: UsePreviewStateResult
  /** 是否显示分页控件 */
  showPagination?: boolean
  /** 下载回调（不传隐藏按钮） */
  onDownload?: () => void
  /** 外部工具栏容器。传入后将通过 Portal 渲染到该容器。 */
  container?: HTMLElement | null
  /** 全屏时应包含预览内容与工具栏的目标元素。 */
  fullscreenTarget?: HTMLElement | null
  /** 工具栏视觉位置。 */
  placement?: 'bottom' | 'header'
  className?: string
}

/**
 * 通用预览工具栏（缩放/旋转/页码/下载/全屏）。
 *
 * 默认渲染在预览内容底部；传入 container 后可通过 Portal 安置到外部标题栏，
 * 同时仍复用当前预览器的状态，避免翻页、缩放等操作与内容脱节。
 */
export function PreviewToolbar({
  config,
  state,
  showPagination = false,
  onDownload,
  container,
  fullscreenTarget,
  placement = 'bottom',
  className,
}: PreviewToolbarProps) {
  const t = useAgentMessages('preview-toolbar')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fallbackFullscreenTarget, setFallbackFullscreenTarget] = useState<HTMLElement | null>(null)
  const target = fullscreenTarget ?? fallbackFullscreenTarget

  useEffect(() => {
    if (!target) return

    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === target
      setIsFullscreen(active)
      if (active) {
        target.style.width = '100vw'
        target.style.height = '100vh'
        target.style.backgroundColor = 'var(--background, hsl(0 0% 100%))'
      } else {
        target.style.width = ''
        target.style.height = ''
        target.style.backgroundColor = ''
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [target])

  const setToolbarRef = useCallback((node: HTMLDivElement | null) => {
    if (!fullscreenTarget) {
      setFallbackFullscreenTarget(node?.parentElement ?? null)
    }
  }, [fullscreenTarget])

  const toggleFullscreen = useCallback(() => {
    if (!target) return
    if (document.fullscreenElement === target) {
      void document.exitFullscreen()
      return
    }
    void target.requestFullscreen?.()
  }, [target])

  const content = (
    <div
      ref={setToolbarRef}
      className={cn(
        'flex shrink-0 items-center gap-1',
        placement === 'header'
          ? 'justify-end py-0'
          : 'justify-center border-t bg-background/95 px-2 py-1.5 backdrop-blur',
        className,
      )}
    >
      {showPagination && state.totalPages > 1 ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarButton
            label={t.prevPage.value}
            onClick={state.prevPage}
            disabled={state.currentPage <= 1}
            tooltipSide={placement === 'header' ? 'bottom' : 'top'}
          >
            <ChevronLeft className="size-4"/>
          </ToolbarButton>
          <span className="min-w-20 px-2 text-center text-xs text-muted-foreground tabular-nums">
            {t.pageOf({current: state.currentPage, total: state.totalPages})}
          </span>
          <ToolbarButton
            label={t.nextPage.value}
            onClick={state.nextPage}
            disabled={state.currentPage >= state.totalPages}
            tooltipSide={placement === 'header' ? 'bottom' : 'top'}
          >
            <ChevronRight className="size-4"/>
          </ToolbarButton>
        </div>
      ) : null}

      {config.zoom ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarButton label={t.zoomOut.value} onClick={state.zoomOut} tooltipSide={placement === 'header' ? 'bottom' : 'top'}>
            <ZoomOut className="size-4"/>
          </ToolbarButton>
          <button
            type="button"
            onClick={state.resetZoom}
            className="min-w-12 cursor-pointer rounded-sm px-2 text-center text-xs text-muted-foreground tabular-nums hover:bg-accent"
          >
            {Math.round(state.zoom * 100)}%
          </button>
          <ToolbarButton label={t.zoomIn.value} onClick={state.zoomIn} tooltipSide={placement === 'header' ? 'bottom' : 'top'}>
            <ZoomIn className="size-4"/>
          </ToolbarButton>
        </div>
      ) : null}

      {config.rotate ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarButton label={t.rotateLeft.value} onClick={state.rotateLeft} tooltipSide={placement === 'header' ? 'bottom' : 'top'}>
            <RotateCcw className="size-4"/>
          </ToolbarButton>
          <ToolbarButton label={t.rotateRight.value} onClick={state.rotateRight} tooltipSide={placement === 'header' ? 'bottom' : 'top'}>
            <RotateCw className="size-4"/>
          </ToolbarButton>
        </div>
      ) : null}

      {config.download && onDownload ? (
        <ToolbarButton label={t.download.value} onClick={onDownload} tooltipSide={placement === 'header' ? 'bottom' : 'top'}>
          <Download className="size-4"/>
        </ToolbarButton>
      ) : null}

      {config.fullscreen ? (
        <ToolbarButton
          label={isFullscreen ? t.exitFullscreen.value : t.fullscreen.value}
          onClick={toggleFullscreen}
          tooltipSide={placement === 'header' ? 'bottom' : 'top'}
        >
          {isFullscreen ? <Minimize className="size-4"/> : <Maximize className="size-4"/>}
        </ToolbarButton>
      ) : null}
    </div>
  )

  return container ? createPortal(content, container) : content
}

interface ToolbarButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  tooltipSide: 'top' | 'bottom'
  children: ReactNode
}

function ToolbarButton({label, onClick, disabled, tooltipSide, children}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          className="size-7"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  )
}