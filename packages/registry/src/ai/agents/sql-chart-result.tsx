"use client"

import {Suspense, useState} from "react"

import {ChartNoAxesCombined, FileDown, FileSpreadsheet, ImageDown, Loader2} from "lucide-react"
import {useAgentMessages} from "../../i18n/runtime"

import {Alert, AlertDescription} from "../../ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../ui/components/empty"
import {Button} from "../../ui/components/button"
import {Skeleton} from "../../ui/components/skeleton"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "../../ui/components/tabs"
import {cn} from "../../ui/lib/utils"
import {toast} from "../../ui/components/sonner"
import type {ChartExportHandle} from "../../charts/types/chart"

import {type ChartSpecV1, type SqlChartResultContent} from "../hooks/use-chat/schema"
import {type SqlQueryResultExportFormat, useSqlQueryResultExportRequest} from "../hooks/use-chat/use-sql-query-result"
import {
  downloadBlob,
  downloadDataUrl,
  ensureDownloadFileExtension,
  sanitizeDownloadFileName,
} from "../lib/browser-download"
import {useAiChatContext} from "./context"
import {SqlQueryDataTable} from "./sql-query-data-table"

import {OptionalSqlChartView as LazySqlQueryChartView} from "../../integration/media";

export interface SqlChartResultProps {
  /** 当前会话 ID；历史消息与子智能体也必须传入各自会话 ID */
  conversationId?: string
  /** SQL 图表结果扩展元数据 */
  result: SqlChartResultContent
  /** 与结果同属一次工具调用的 SQL；为兼容调用方保留，但界面不再渲染。 */
  sql?: string
  /** 卡片标题，优先使用工具执行摘要 */
  title?: string
  /** 嵌入统一工具卡片时隐藏自身外框和重复标题 */
  embedded?: boolean
}

type ResultTab = "chart" | "table"

interface ChartAvailability {
  spec?: ChartSpecV1
  fallback: "none" | "unsupported-version" | "invalid-spec"
}

function resolveChartAvailability(result: SqlChartResultContent): ChartAvailability {
  if (result.chart.version !== 1) return {fallback: "unsupported-version"}
  return {fallback: "none", spec: result.chart}
}

/** SQL 图表结果卡片，提供图表和数据表入口。 */
export function SqlChartResult({conversationId, result, title, embedded = false}: SqlChartResultProps) {
  const t = useAgentMessages("sql-chart-result")
  const cardTitle = title?.trim() || t.title
  const {httpClient} = useAiChatContext()
  const availability = resolveChartAvailability(result)
  const [tab, setTab] = useState<ResultTab>(availability.spec ? "chart" : "table")
  const [chartExportHandle, setChartExportHandle] = useState<ChartExportHandle | null>(null)
  const [exportingFormat, setExportingFormat] = useState<SqlQueryResultExportFormat | null>(null)
  const {runAsync: exportResult, loading: exportLoading} = useSqlQueryResultExportRequest(
    httpClient,
    conversationId ?? "",
    result.resultId
  )

  const handleTabChange = (value: string) => {
    if (value === "chart" || value === "table") setTab(value)
  }

  const fallbackMessage = availability.fallback === "unsupported-version"
    ? t.unsupportedVersion
    : availability.fallback === "invalid-spec"
      ? t.invalidSpec
      : undefined

  const handleExportImage = () => {
    if (!chartExportHandle || !availability.spec) return

    try {
      const dataUrl = chartExportHandle.getDataUrl({type: "png", pixelRatio: 2})
      const baseName = sanitizeDownloadFileName(availability.spec.title, "sql-chart")
      downloadDataUrl(dataUrl, ensureDownloadFileExtension(baseName, ".png"))
      toast.success(t.imageExportSuccess.value)
    } catch (exportError) {
      console.error("[SqlChartResult] SQL chart image export failed", {
        resultId: result.resultId,
        error: exportError,
      })
      toast.error(t.imageExportError.value)
    }
  }

  const handleExportData = async (format: SqlQueryResultExportFormat) => {
    if (exportLoading) return
    setExportingFormat(format)

    try {
      const response = await exportResult(format)
      const extension = format === "CSV" ? ".csv" : ".xlsx"
      const fallbackBaseName = `sql-query-result-${result.resultId}`
      const safeFileName = sanitizeDownloadFileName(response.filename ?? fallbackBaseName, fallbackBaseName)
      downloadBlob(new Blob([Uint8Array.from(response.bytes).buffer], {type: response.contentType ?? "application/octet-stream"}), ensureDownloadFileExtension(safeFileName, extension))
      toast.success(t.dataExportSuccess.value)
    } catch {
      // useApiRequest 已统一记录并通知导出错误，此处仅维护按钮的局部加载状态。
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <div className={cn(
      "min-w-0 overflow-hidden",
      !embedded && "rounded-md border border-border bg-background",
    )}>
      {!embedded ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2">
          <ChartNoAxesCombined className="size-4 shrink-0 text-brand"/>
          <span className="text-sm font-medium text-foreground">{cardTitle}</span>
          <span className="text-xs text-muted-foreground">
            {t.summary({rows: result.rowCount, columns: result.columnCount})}
          </span>
        </div>
      ) : null}


      {!conversationId ? (
        <Alert className="m-3 w-auto">
          <AlertDescription>{t.unavailable}</AlertDescription>
        </Alert>
      ) : result.rowCount === 0 ? (
        <Empty className="min-h-48">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ChartNoAxesCombined/></EmptyMedia>
            <EmptyTitle>{cardTitle}</EmptyTitle>
            <EmptyDescription>{t.empty}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {fallbackMessage ? (
            <Alert className="m-3 w-auto">
              <AlertDescription>{fallbackMessage}</AlertDescription>
            </Alert>
          ) : null}

          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex min-w-0 items-center justify-between gap-2 overflow-x-auto border-b border-border px-3 py-2">
              <TabsList className="shrink-0">
                {availability.spec ? <TabsTrigger value="chart">{t.chartTab}</TabsTrigger> : null}
                <TabsTrigger value="table">{t.tableTab}</TabsTrigger>
              </TabsList>
              <div className="flex shrink-0 items-center justify-end gap-2">
                {tab === "chart" && availability.spec ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!chartExportHandle}
                    onClick={handleExportImage}
                  >
                    <ImageDown data-icon="inline-start"/>
                    {t.exportImage}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportLoading}
                      onClick={() => void handleExportData("CSV")}
                    >
                      {exportingFormat === "CSV" ? (
                        <Loader2 data-icon="inline-start" className="animate-spin"/>
                      ) : (
                        <FileDown data-icon="inline-start"/>
                      )}
                      {t.exportCsv}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportLoading}
                      onClick={() => void handleExportData("XLSX")}
                    >
                      {exportingFormat === "XLSX" ? (
                        <Loader2 data-icon="inline-start" className="animate-spin"/>
                      ) : (
                        <FileSpreadsheet data-icon="inline-start"/>
                      )}
                      {t.exportExcel}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {availability.spec ? (
              <TabsContent value="chart" className="mt-0">
                {tab === "chart" ? (
                  <Suspense fallback={<Skeleton className="m-3 h-[360px] w-auto"/>}>
                    <LazySqlQueryChartView
                      conversationId={conversationId}
                      result={result}
                      spec={availability.spec}
                      onShowTable={() => setTab("table")}
                      onExportHandleChange={setChartExportHandle}
                    />
                  </Suspense>
                ) : null}
              </TabsContent>
            ) : null}
            <TabsContent value="table" className="mt-0">
              {tab === "table" ? <SqlQueryDataTable conversationId={conversationId} result={result}/> : null}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
