import {BarChart as EChartsBarChart, LineChart as EChartsLineChart, PieChart as EChartsPieChart} from "echarts/charts"
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components"
import {use as registerEChartsModules} from "echarts/core"
import {CanvasRenderer} from "echarts/renderers"

let registered = false

/** 注册声明式组件所需的最小 ECharts 模块集合。 */
export function registerECharts(): void {
  if (registered) return

  registerEChartsModules([
    EChartsBarChart,
    EChartsLineChart,
    EChartsPieChart,
    AriaComponent,
    DataZoomComponent,
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
    CanvasRenderer,
  ])
  registered = true
}
