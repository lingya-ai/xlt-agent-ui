"use client"

import {DEFAULT_CHART_HEIGHT} from "../constants/chart-theme"
import {buildCartesianOption} from "../engine/build-cartesian-option"
import {useChartTheme} from "../hooks/use-chart-theme"
import {useReducedMotion} from "../hooks/use-reduced-motion"
import type {
  ChartBarLineSeries,
  ChartBaseProps,
  ChartCategoryDatum,
  ChartOrientation,
} from "../types/chart"
import {ChartCanvas} from "./chart-canvas"

interface CartesianChartProps extends ChartBaseProps {
  categories: readonly ChartCategoryDatum[]
  series: readonly ChartBarLineSeries[]
  orientation: ChartOrientation
}

export function CartesianChart({
  active = true,
  animationPointThreshold,
  ariaLabel,
  categories,
  className,
  dataZoom = "none",
  formatCategory,
  formatValue,
  height = DEFAULT_CHART_HEIGHT,
  onError,
  onExportHandleChange,
  onReady,
  orientation,
  series,
  showLegend = true,
  subtitle,
  theme = "auto",
  title,
}: CartesianChartProps) {
  const resolvedTheme = useChartTheme(theme)
  const reducedMotion = useReducedMotion()
  const option = buildCartesianOption({
    animationPointThreshold,
    categories,
    dataZoom,
    formatCategory,
    formatValue,
    onError,
    orientation,
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
