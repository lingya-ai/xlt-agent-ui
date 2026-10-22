"use client"

import type {CSSProperties} from "react"

import type {WorkspaceChartOption} from "../engine/chart-option"
import {useECharts} from "../hooks/use-echarts"
import type {ChartExportHandle, ResolvedChartTheme} from "../types/chart"

interface ChartCanvasProps {
  active: boolean
  ariaLabel: string
  className?: string
  height: number | string
  onError?: (error: Error) => void
  onExportHandleChange?: (handle: ChartExportHandle | null) => void
  onReady?: () => void
  option: WorkspaceChartOption
  theme: ResolvedChartTheme
}

export function ChartCanvas({
  active,
  ariaLabel,
  className,
  height,
  onError,
  onExportHandleChange,
  onReady,
  option,
  theme,
}: ChartCanvasProps) {
  const containerRef = useECharts({active, option, theme, onReady, onExportHandleChange, onError})
  const style: CSSProperties = {
    height,
    minHeight: typeof height === "number" ? Math.max(1, height) : 1,
    minWidth: 0,
    width: "100%",
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
      data-chart-active={active ? "true" : "false"}
      data-chart-theme={theme}
    />
  )
}
