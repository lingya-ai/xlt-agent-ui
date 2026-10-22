export type ChartThemeMode = "light" | "dark" | "auto"

export type ResolvedChartTheme = Exclude<ChartThemeMode, "auto">

export type ChartOrientation = "vertical" | "horizontal"

export type ChartAxis = "primary" | "secondary"

export type ChartDataZoom = "none" | "auto"

export interface ChartImageExportOptions {
  /** 图片格式，默认 PNG。 */
  type?: "png" | "jpeg"
  /** 导出像素倍率，默认 2。 */
  pixelRatio?: number
  /** 图片背景色；未设置时根据当前图表主题选择。 */
  backgroundColor?: string
}

/** 不暴露 ECharts 实例的图表导出句柄。 */
export interface ChartExportHandle {
  getDataUrl: (options?: ChartImageExportOptions) => string
}

export interface ChartCategoryDatum {
  key: string
  label: string
  sourceIndex: number
}

export interface ChartValueDatum {
  value: number | null
  rawValue?: string | number | null
  sourceIndex: number
  wasNull?: boolean
}

export interface ChartSeriesBase {
  id: string
  name: string
  axis?: ChartAxis
  values: readonly ChartValueDatum[]
  color?: string
}

export interface ChartBarSeries extends ChartSeriesBase {
  type: "bar"
  stackId?: string
}

export interface ChartLineSeries extends ChartSeriesBase {
  type: "line"
}

export type ChartBarLineSeries = ChartBarSeries | ChartLineSeries

export interface ChartStackedBarSeries extends ChartBarSeries {
  stackId: string
}

export interface ChartPieSeries extends ChartSeriesBase {
  type: "pie"
}

export interface ChartCategoryFormatterContext {
  datum: ChartCategoryDatum
  dataIndex: number
}

export interface ChartValueFormatterContext {
  datum: ChartValueDatum
  category: ChartCategoryDatum
  series: ChartSeriesBase
  dataIndex: number
}

export interface ChartBaseProps {
  ariaLabel: string
  height?: number | string
  theme?: ChartThemeMode
  active?: boolean
  title?: string
  subtitle?: string
  showLegend?: boolean
  dataZoom?: ChartDataZoom
  animationPointThreshold?: number
  formatCategory?: (context: ChartCategoryFormatterContext) => string
  formatValue?: (context: ChartValueFormatterContext) => string
  onReady?: () => void
  onExportHandleChange?: (handle: ChartExportHandle | null) => void
  onError?: (error: Error) => void
  className?: string
}

export interface BarChartProps extends ChartBaseProps {
  categories: readonly ChartCategoryDatum[]
  series: readonly ChartBarSeries[]
  orientation?: ChartOrientation
}

export interface LineChartProps extends ChartBaseProps {
  categories: readonly ChartCategoryDatum[]
  series: readonly ChartLineSeries[]
  orientation?: ChartOrientation
}

export interface BarLineChartProps extends ChartBaseProps {
  categories: readonly ChartCategoryDatum[]
  series: readonly ChartBarLineSeries[]
  orientation?: ChartOrientation
}

export interface StackedBarChartProps extends ChartBaseProps {
  categories: readonly ChartCategoryDatum[]
  series: readonly ChartStackedBarSeries[]
  orientation?: ChartOrientation
}

export interface PieChartProps extends ChartBaseProps {
  categories: readonly ChartCategoryDatum[]
  series: ChartPieSeries
}
