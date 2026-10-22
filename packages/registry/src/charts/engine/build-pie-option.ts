import {
  CHART_THEMES,
  DEFAULT_ANIMATION_POINT_THRESHOLD,
} from "../constants/chart-theme"
import type {
  ChartBaseProps,
  ChartCategoryDatum,
  ChartPieSeries,
  ResolvedChartTheme,
} from "../types/chart"
import {buildTooltipFormatter, safelyFormatCategory} from "./build-tooltip"
import type {PieChartOption} from "./chart-option"

export interface BuildPieOptionInput extends Pick<
  ChartBaseProps,
  | "title"
  | "subtitle"
  | "showLegend"
  | "animationPointThreshold"
  | "formatCategory"
  | "formatValue"
  | "onError"
> {
  categories: readonly ChartCategoryDatum[]
  series: ChartPieSeries
  theme: ResolvedChartTheme
  reducedMotion?: boolean
}

/** 将声明式饼图模型转换为固定、不可注入的 ECharts option。 */
export function buildPieOption(input: BuildPieOptionInput): PieChartOption {
  const tokens = CHART_THEMES[input.theme]
  const animationThreshold = input.animationPointThreshold ?? DEFAULT_ANIMATION_POINT_THRESHOLD
  const animation = !input.reducedMotion && input.categories.length <= animationThreshold

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
      show: input.showLegend ?? true,
      type: "scroll",
      orient: "horizontal",
      left: 8,
      right: 8,
      bottom: 0,
      textStyle: {color: tokens.mutedText},
    },
    tooltip: {
      trigger: "item",
      renderMode: "richText",
      confine: true,
      backgroundColor: tokens.tooltipBackground,
      borderColor: tokens.tooltipBorder,
      textStyle: {color: tokens.text},
      formatter: buildTooltipFormatter({
        ...input,
        series: [input.series],
      }),
    },
    series: [
      {
        id: input.series.id,
        name: input.series.name,
        type: "pie",
        radius: ["30%", "58%"],
        center: ["50%", "52%"],
        avoidLabelOverlap: true,
        itemStyle: input.series.color ? {color: input.series.color} : undefined,
        label: {
          color: tokens.mutedText,
          formatter: (params: {dataIndex: number}): string => {
            const category = input.categories[params.dataIndex]
            return category
              ? safelyFormatCategory(category, params.dataIndex, input.formatCategory, input.onError)
              : ""
          },
        },
        emphasis: {focus: "self", scale: true},
        data: input.categories.map((category, index) => ({
          name: category.label,
          value: input.series.values[index]?.value ?? undefined,
        })),
      },
    ],
  }
}
