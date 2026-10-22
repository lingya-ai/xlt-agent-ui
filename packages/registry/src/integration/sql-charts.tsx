"use client";
import {lazy, type ReactNode} from "react";
import {AgentMediaProvider} from "./media";
const SqlChart = lazy(() => import("../ai/agents/sql-query-chart-view").then(module => ({default: module.SqlQueryChartView})));
/** SQL 图表条目显式引入 ECharts，按需加载图表实现。 */
export function AgentSqlChartsProvider({children}: {children: ReactNode}) {
  return <AgentMediaProvider sqlChart={SqlChart}>{children}</AgentMediaProvider>;
}
