import {useCallback, useEffect, useRef} from "react"

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useApiRequest, type UseApiRequestResult} from "../../../api/hooks/use-api-request"
import type {DownloadResponse} from "@lingya-ai/agents-sdk/browser"
import {buildScopedChatClientCacheKey} from "../../lib/chat-client-cache-key";
import {useAiChatRequestSignal} from "../../agents/context";

import {
  type ExcelSqlChartDataset,
  type SqlQueryResultPage,
} from "./schema"

/** SQL 查询结果分页参数 */
export interface SqlQueryResultPageInput {
  /** 当前页码，从 0 开始 */
  current: number
  /** 每页大小 */
  size: number
}

/** SQL 查询结果后端导出格式。 */
export type SqlQueryResultExportFormat = "CSV" | "XLSX"

type SqlResultProjection = "page" | "chart-data"

/** 构造包含聊天控制器范围与投影类型的 SQL 结果缓存键。 */
export function buildSqlResultCacheKey(
  httpClient: AgentsClient,
  conversationId: string | undefined,
  resultId: string,
  projection: SqlResultProjection,
  page?: SqlQueryResultPageInput,
  scope?: object
): string {
  return buildScopedChatClientCacheKey(
    httpClient,
    scope??httpClient,
    "sql-result",
    conversationId ?? "unknown",
    resultId,
    projection,
    ...(page ? [page.current, page.size] : []),
  )
}

/**
 * 创建 SQL 查询结果分页请求函数
 *
 * @param httpClient 已配置聊天服务 baseURL 的 HTTP 客户端
 * @returns SQL 查询结果分页请求函数
 */
export function useSqlQueryResultCallback(
  httpClient: AgentsClient
): (conversationId: string, resultId: string, input: SqlQueryResultPageInput) => Promise<SqlQueryResultPage> {
  const providerSignal=useAiChatRequestSignal(httpClient);
  return useCallback(
    (conversationId: string, resultId: string, input: SqlQueryResultPageInput): Promise<SqlQueryResultPage> => {
      return httpClient.sql.getSqlQueryResult(conversationId, resultId, {current: input.current, size: input.size,signal:providerSignal})
    },
    [httpClient,providerSignal]
  )
}

/** 构造经过路径编码的 SQL 结果资源地址。 */
export function buildSqlQueryResultPath(conversationId: string, resultId: string): string {
  return `/chat/conversations/${encodeURIComponent(conversationId)}` +
    `/sql-query-results/${encodeURIComponent(resultId)}`
}

/** 构造经过路径编码的 SQL 结果文件导出地址。 */
export function buildSqlQueryResultExportPath(conversationId: string, resultId: string): string {
  return `${buildSqlQueryResultPath(conversationId, resultId)}/export`
}

/** 创建 SQL 查询结果文件导出请求函数。 */
export function useSqlQueryResultExportCallback(
  httpClient: AgentsClient
): (conversationId: string, resultId: string, format: SqlQueryResultExportFormat) => Promise<DownloadResponse> {
  const providerSignal=useAiChatRequestSignal(httpClient);
  return useCallback(
    (conversationId: string, resultId: string, format: SqlQueryResultExportFormat) => {
      return httpClient.sql.exportSqlQueryResultWithMetadata(conversationId, resultId, {format,signal:providerSignal})
    },
    [httpClient,providerSignal]
  )
}

/** 手动触发 SQL 查询结果 CSV/XLSX 导出。 */
export function useSqlQueryResultExportRequest(
  httpClient: AgentsClient,
  conversationId: string,
  resultId: string
): UseApiRequestResult<DownloadResponse, [SqlQueryResultExportFormat]> {
  const exportSqlQueryResult = useSqlQueryResultExportCallback(httpClient)

  return useApiRequest(
    (format: SqlQueryResultExportFormat) => exportSqlQueryResult(conversationId, resultId, format),
    {manual: true}
  )
}

/**
 * 分页加载已持久化的 SQL 查询结果
 *
 * SQL 结果在扩展事件推送前已进入 READY 状态，因此只按页请求，不进行轮询。
 */
export function useSqlQueryResultRequest(
  httpClient: AgentsClient,
  conversationId: string | undefined,
  resultId: string,
  current: number,
  size: number
): UseApiRequestResult<SqlQueryResultPage, unknown[]> {
  const scope=useAiChatRequestSignal(httpClient);
  const fetchSqlQueryResult = useSqlQueryResultCallback(httpClient)

  return useApiRequest(
    () => fetchSqlQueryResult(conversationId ?? "", resultId, {current, size}),
    {
      ready: Boolean(conversationId && resultId),
      refreshDeps: [conversationId, resultId, current, size, fetchSqlQueryResult],
      cacheKey: buildSqlResultCacheKey(httpClient, conversationId, resultId, "page", {current, size},scope),
      staleTime: 30 * 60 * 1000,
      disableErrorNotification: true,
    }
  )
}

/** 创建 SQL 图表列式数据请求函数。 */
export function useSqlChartDatasetCallback(
  httpClient: AgentsClient
): (conversationId: string, resultId: string, signal?: AbortSignal) => Promise<ExcelSqlChartDataset> {
  const providerSignal=useAiChatRequestSignal(httpClient);
  return useCallback(
    (conversationId: string, resultId: string, signal?: AbortSignal): Promise<ExcelSqlChartDataset> => {
      return httpClient.sql.getSqlQueryChartData(conversationId, resultId, {signal:signal??providerSignal})
    },
    [httpClient,providerSignal]
  )
}

/** 按需加载并短期缓存不可变的 SQL 图表数据集。 */
export function useSqlChartDatasetRequest(
  httpClient: AgentsClient,
  conversationId: string | undefined,
  resultId: string,
  ready: boolean
): UseApiRequestResult<ExcelSqlChartDataset, unknown[]> {
  const scope=useAiChatRequestSignal(httpClient);
  const fetchSqlChartDataset = useSqlChartDatasetCallback(httpClient)
  const abortControllerRef = useRef<AbortController | null>(null)
  const service = useCallback(async (): Promise<ExcelSqlChartDataset> => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    try {
      return await fetchSqlChartDataset(conversationId ?? "", resultId, controller.signal)
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }, [conversationId, fetchSqlChartDataset, resultId])

  const request = useApiRequest(service, {
    ready: Boolean(ready && conversationId && resultId),
    refreshDeps: [conversationId, resultId, ready, service],
    cacheKey: buildSqlResultCacheKey(httpClient, conversationId, resultId, "chart-data",undefined,scope),
    cacheTime: 10 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
    disableErrorNotification: true,
  })
  const cancelRequest = request.cancel

  useEffect(() => {
    if (ready) return
    cancelRequest()
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [cancelRequest, ready])

  useEffect(() => () => {
    cancelRequest()
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [cancelRequest])

  return request
}
