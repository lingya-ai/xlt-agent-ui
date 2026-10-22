import type {BarSeriesOption, LineSeriesOption} from "echarts/charts"

import {
  CHART_THEMES,
  DEFAULT_ANIMATION_POINT_THRESHOLD,
  DEFAULT_DATA_ZOOM_CATEGORY_THRESHOLD,
} from "../constants/chart-theme"
import type {
  ChartBarLineSeries,
  ChartBaseProps,
  ChartCategoryDatum,
  ChartOrientation,
  ResolvedChartTheme,
} from "../types/chart"
import {buildTooltipFormatter, safelyFormatCategory} from "./build-tooltip"
import type {CartesianChartOption} from "./chart-option"

export interface BuildCartesianOptionInput extends Pick<
  ChartBaseProps,
  | "title"
  | "subtitle"
  | "showLegend"
  | "dataZoom"
  | "animationPointThreshold"
  | "formatCategory"
  | "formatValue"
  | "onError"
> {
  categories: readonly ChartCategoryDatum[]
  series: readonly ChartBarLineSeries[]
  orientation: ChartOrientation
  theme: ResolvedChartTheme
  reducedMotion?: boolean
}

function axisIndex(axis: ChartBarLineSeries["axis"]): number {
  return axis === "secondary" ? 1 : 0
}

function buildSeries(
  input: BuildCartesianOptionInput,
  series: ChartBarLineSeries
): BarSeriesOption | LineSeriesOption {
  const data = input.categories.map((_, index) => series.values[index]?.value ?? null)
  const common = {
    id: series.id,
    name: series.name,
    data,
    itemStyle: series.color ? {color: series.color} : undefined,
    emphasis: {focus: "series" as const},
  }
  const valueAxisIndex = axisIndex(series.axis)

  if (series.type === "bar") {
    return {
      ...common,
      type: "bar",
      large: !series.stackId && data.length > DEFAULT_ANIMATION_POINT_THRESHOLD,
      largeThreshold: DEFAULT_ANIMATION_POINT_THRESHOLD,
      ...(input.orientation === "vertical"
        ? {yAxisIndex: valueAxisIndex}
        : {xAxisIndex: valueAxisIndex}),
      ...( "stackId" in series && series.stackId ? {stack: series.stackId} : {}),
    }
  }

  return {
    ...common,
    type: "line",
    connectNulls: false,
    showSymbol: data.length <= 100,
    symbol: "circle",
    symbolSize: 6,
    lineStyle: series.color ? {color: series.color} : undefined,
    ...(input.orientation === "vertical"
      ? {yAxisIndex: valueAxisIndex}
      : {xAxisIndex: valueAxisIndex}),
  }
}

/** 将声明式笛卡尔模型转换为固定、不可注入的 ECharts option。 */
export function buildCartesianOption(input: BuildCartesianOptionInput): CartesianChartOption {
  const tokens = CHART_THEMES[input.theme]
  const showDataZoom = input.dataZoom === "auto" && input.categories.length > DEFAULT_DATA_ZOOM_CATEGORY_THRESHOLD
  const showLegend = input.showLegend ?? true
  const totalPoints = input.categories.length * input.series.length
  const animationThreshold = input.animationPointThreshold ?? DEFAULT_ANIMATION_POINT_THRESHOLD
  const animation = !input.reducedMotion && totalPoints <= animationThreshold
  const categoryData = input.categories.map((category) => category.label)
  const categoryAxis = {
    type: "category" as const,
    data: categoryData,
    inverse: input.orientation === "horizontal",
    axisLine: {lineStyle: {color: tokens.axis}},
    axisTick: {alignWithLabel: true},
    axisLabel: {
      color: tokens.mutedText,
      hideOverlap: true,
      formatter: (_value: string, index: number): string => {
        const category = input.categories[index]
        return category
          ? safelyFormatCategory(category, index, input.formatCategory, input.onError)
          : ""
      },
    },
  }
  const primaryValueAxis = {
    type: "value" as const,
    axisLine: {show: true, lineStyle: {color: tokens.axis}},
    axisLabel: {color: tokens.mutedText},
    splitLine: {lineStyle: {color: tokens.splitLine}},
  }
  const secondaryValueAxis = {
    type: "value" as const,
    axisLine: {show: true, lineStyle: {color: tokens.axis}},
    axisLabel: {color: tokens.mutedText},
    splitLine: {show: false},
  }
  const usesSecondaryAxis = input.series.some((series) => series.axis === "secondary")
  const numberAxes = usesSecondaryAxis
    ? [primaryValueAxis, secondaryValueAxis]
    : [primaryValueAxis]

  return {
    animation,
    aria: {enabled: true, decal: {show: true}},
    backgroundColor: "transparent",
    color: [...tokens.palette],
    title: input.title
      ? {
          text: input.title,
          subtext: input.subtitle,
          textStyle: {color: tokens.text, fontSize: 16, fontWeight: 600},
          subtextStyle: {color: tokens.mutedText, fontSize: 12},
        }
      : undefined,
    legend: {
      show: showLegend,
      bottom: 0,
      left: "center",
      textStyle: {color: tokens.mutedText},
    },
    grid: {
      top: input.title ? 86 : 42,
      right: usesSecondaryAxis ? 56 : 24,
      bottom: showDataZoom ? (showLegend ? 96 : 72) : (showLegend ? 60 : 28),
      left: 52,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      renderMode: "richText",
      confine: true,
      backgroundColor: tokens.tooltipBackground,
      borderColor: tokens.tooltipBorder,
      textStyle: {color: tokens.text},
      formatter: buildTooltipFormatter(input),
    },
    ...(input.orientation === "vertical"
      ? {xAxis: categoryAxis, yAxis: numberAxes}
      : {xAxis: numberAxes, yAxis: categoryAxis}),
    dataZoom: showDataZoom
      ? [
          {
            type: "inside" as const,
            ...(input.orientation === "vertical" ? {xAxisIndex: [0]} : {yAxisIndex: [0]}),
          },
          input.orientation === "vertical"
            ? {
                type: "slider" as const,
                height: 22,
                bottom: showLegend ? 38 : 16,
                borderColor: tokens.axis,
                textStyle: {color: tokens.mutedText},
                xAxisIndex: [0],
              }
            : {
                type: "slider" as const,
                width: 22,
                right: 8,
                top: 54,
                bottom: 24,
                borderColor: tokens.axis,
                textStyle: {color: tokens.mutedText},
                yAxisIndex: [0],
              },
        ]
      : undefined,
    series: input.series.map((series) => buildSeries(input, series)),
  }
}
