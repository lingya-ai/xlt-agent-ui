"use client"

import {lazy, Suspense, useEffect, useRef, useState, type ReactNode} from "react"

import {useInViewport} from "ahooks"
import {useAgentMessages, useAgentLocale} from "../../i18n/runtime"

import {Alert, AlertDescription} from "../../ui/components/alert"
import {Button} from "../../ui/components/button"
import {Skeleton} from "../../ui/components/skeleton"
import type {ChartExportHandle} from "../../charts/types/chart"


import {useSqlChartDatasetRequest} from "../hooks/use-chat/use-sql-query-result"
import {useAiChatContext} from "./context"
import {
  toWorkspaceChartModel,
  validateSqlChartDataset,
  type WorkspaceSqlChartModel,
} from "./sql-chart-adapter"

const LazyBarChart = lazy(() => import("../../charts/components/bar-chart").then((module) => ({default: module.BarChart})))
const LazyLineChart = lazy(() => import("../../charts/components/line-chart").then((module) => ({default: module.LineChart})))
const LazyBarLineChart = lazy(() => import("../../charts/components/bar-line-chart").then((module) => ({default: module.BarLineChart})))
const LazyStackedBarChart = lazy(() => import("../../charts/components/stacked-bar-chart").then((module) => ({default: module.StackedBarChart})))
const LazyPieChart = lazy(() => import("../../charts/components/pie-chart").then((module) => ({default: module.PieChart})))

import type {SqlQueryChartViewProps} from "../../integration/chart-view-props";

interface ChartRendererProps {
  active: boolean
  ariaLabel: string
  model: WorkspaceSqlChartModel
  onError: (error: Error) => void
  onExportHandleChange: (handle: ChartExportHandle | null) => void
}

function ChartRenderer({active, ariaLabel, model, onError, onExportHandleChange}: ChartRendererProps) {
  const commonProps = {
    active,
    animationPointThreshold: 1000,
    ariaLabel,
    categories: model.categories,
    dataZoom: model.dataZoom,
    formatValue: model.formatValue,
    height: 360,
    onError,
    onExportHandleChange,
    showLegend: model.showLegend,
    subtitle: model.subtitle,
    title: model.title,
  }

  switch (model.kind) {
    case "bar":
      return <LazyBarChart {...commonProps} orientation={model.orientation} series={model.series}/>
    case "line":
      return <LazyLineChart {...commonProps} orientation={model.orientation} series={model.series}/>
    case "bar-line":
      return <LazyBarLineChart {...commonProps} orientation={model.orientation} series={model.series}/>
    case "stacked-bar":
      return <LazyStackedBarChart {...commonProps} orientation={model.orientation} series={model.series}/>
    case "pie":
      return <LazyPieChart {...commonProps} series={model.series}/>
  }
}

/** 请求、校验并渲染单个 SQL 图表，所有异常都限制在当前结果卡片内。 */
export function SqlQueryChartView({
  conversationId,
  result,
  spec,
  onShowTable,
  onExportHandleChange,
}: SqlQueryChartViewProps) {
  const t = useAgentMessages("sql-query-chart-view")
  const {locale} = useAgentLocale()
  const {httpClient} = useAiChatContext()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [inViewport] = useInViewport(viewportRef, {rootMargin: "200px"})
  const active = inViewport === true
  const {data, loading, error, refresh} = useSqlChartDatasetRequest(
    httpClient,
    conversationId,
    result.resultId,
    active
  )
  const [renderError, setRenderError] = useState<Error | null>(null)
  const adapterLocale = locale === "zh" ? "zh-CN" : "en-US"
  const validation = data
    ? validateSqlChartDataset(result, spec, data, adapterLocale)
    : undefined
  const validationReason = validation && !validation.ok ? validation.reason : undefined
  const validationColumn = validation && !validation.ok ? validation.column : undefined

  useEffect(() => {
    if (!validationReason) return
    console.error("[SqlQueryChartView] SQL chart validation failed", {
      resultId: result.resultId,
      reason: validationReason,
      column: validationColumn,
    })
  }, [result.resultId, validationColumn, validationReason])

  let model: WorkspaceSqlChartModel | undefined
  let adapterFailureMessage: string | undefined
  if (data && validation?.ok) {
    try {
      model = toWorkspaceChartModel(spec, data, {
        locale: adapterLocale,
        tenantZoneId: result.timeContext.tenantZoneId,
        messages: {
          nullValue: t.nullValue.value,
          zeroFilledSuffix: t.zeroFilledSuffix.value,
        },
      })
    } catch (adapterError) {
      adapterFailureMessage = adapterError instanceof Error ? adapterError.message : String(adapterError)
    }
  }

  useEffect(() => {
    if (!adapterFailureMessage) return
    console.error("[SqlQueryChartView] SQL chart adapter failed", {
      resultId: result.resultId,
      error: adapterFailureMessage,
    })
  }, [adapterFailureMessage, result.resultId])

  const handleRequestRetry = () => {
    setRenderError(null)
    refresh()
  }

  const renderFailure = (message: ReactNode, onRetry?: () => void) => (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        <span className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {t.retry}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onShowTable}>
            {t.showTable}
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  )

  return (
    <div ref={viewportRef} className="flex min-h-[360px] min-w-0 flex-col gap-3 p-3">
      {!active && !data ? (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          {t.waiting}
        </div>
      ) : null}

      {active && loading && !data ? (
        <div aria-label={t.loading.value}>
          <Skeleton className="h-[360px] w-full"/>
        </div>
      ) : null}

      {error && !data ? renderFailure(t.loadError, handleRequestRetry) : null}
      {data && validation && !validation.ok ? renderFailure(t.invalidData) : null}
      {data && validation?.ok && !model ? renderFailure(t.invalidData) : null}
      {renderError ? renderFailure(t.renderError, () => setRenderError(null)) : null}

      {model && !renderError ? (
        <Suspense fallback={<Skeleton className="h-[360px] w-full"/>}>
          <ChartRenderer
            active={active}
            ariaLabel={t.ariaLabel({title: spec.title}).value}
            model={model}
            onError={setRenderError}
            onExportHandleChange={onExportHandleChange}
          />
        </Suspense>
      ) : null}

    </div>
  )
}
