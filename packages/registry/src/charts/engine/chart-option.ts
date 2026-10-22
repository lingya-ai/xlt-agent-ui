import type {BarSeriesOption, LineSeriesOption, PieSeriesOption} from "echarts/charts"
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
} from "echarts/components"
import type {ComposeOption} from "echarts/core"

type CommonComponentOption =
  | AriaComponentOption
  | DataZoomComponentOption
  | GridComponentOption
  | LegendComponentOption
  | TitleComponentOption
  | TooltipComponentOption

export type CartesianChartOption = ComposeOption<CommonComponentOption | BarSeriesOption | LineSeriesOption>

export type PieChartOption = ComposeOption<CommonComponentOption | PieSeriesOption>

export type WorkspaceChartOption = CartesianChartOption | PieChartOption
