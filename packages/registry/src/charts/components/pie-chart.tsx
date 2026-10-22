"use client"

import {DEFAULT_CHART_HEIGHT} from "../constants/chart-theme"
import {buildPieOption} from "../engine/build-pie-option"
import {useChartTheme} from "../hooks/use-chart-theme"
import {useReducedMotion} from "../hooks/use-reduced-motion"
import type {PieChartProps} from "../types/chart"
import {ChartCanvas} from "./chart-canvas"

export function PieChart({
  active = true,
  animationPointThreshold,
  ariaLabel,
  categories,
  className,
  formatCategory,
  formatValue,
  height = DEFAULT_CHART_HEIGHT,
  onError,
  onExportHandleChange,
  onReady,
  series,
  showLegend = true,
  subtitle,
  theme = "auto",
  title,
}: PieChartProps) {
  const resolvedTheme = useChartTheme(theme)
  const reducedMotion = useReducedMotion()
  const option = buildPieOption({
    animationPointThreshold,
    categories,
    formatCategory,
    formatValue,
    onError,
    reducedMotion,
    series,
    showLegend,
    subtitle,
    theme: resolvedTheme,
    title,
  })

  return (
    <ChartCanvas
      active={active}
      ariaLabel={ariaLabel}
      className={className}
      height={height}
      onError={onError}
      onExportHandleChange={onExportHandleChange}
      onReady={onReady}
      option={option}
      theme={resolvedTheme}
    />
  )
}

export type {PieChartProps} from "../types/chart"
