"use client"

import {DatabaseZap} from "lucide-react"
import {useAgentMessages} from "../../i18n/runtime"

import {Alert, AlertDescription} from "../../ui/components/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../ui/components/empty"
import {cn} from "../../ui/lib/utils"

import {type SqlQueryResultContent} from "../hooks/use-chat/schema"
import {SqlQueryDataTable} from "./sql-query-data-table"

export interface SqlQueryResultProps {
  /** 当前会话 ID；历史消息与子智能体也必须传入各自会话 ID */
  conversationId?: string
  /** 普通 SQL 表格结果扩展元数据 */
  result: SqlQueryResultContent
  /** 与结果同属一次工具调用的 SQL；为兼容调用方保留，但界面不再渲染。 */
  sql?: string
  /** 卡片标题，优先使用工具执行摘要 */
  title?: string
  /** 嵌入统一工具卡片时隐藏自身外框和重复标题 */
  embedded?: boolean
}

/** SQL 查询结果卡片，展示分页表格和截断提示。 */
export function SqlQueryResult({conversationId, result, title, embedded = false}: SqlQueryResultProps) {
  const t = useAgentMessages("sql-query-result")
  const cardTitle = title?.trim() || t.title

  return (
    <div className={cn(
      "min-w-0 overflow-hidden",
      !embedded && "rounded-md border border-border bg-background",
    )}>
      {!embedded ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2">
          <DatabaseZap className="size-4 shrink-0 text-brand"/>
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
            <EmptyMedia variant="icon"><DatabaseZap/></EmptyMedia>
            <EmptyTitle>{cardTitle}</EmptyTitle>
            <EmptyDescription>{t.empty}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <SqlQueryDataTable conversationId={conversationId} result={result}/>
      )}

      {result.truncated ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {t.truncated({limit: result.limit, rowCount: result.totalRowCount})}
        </p>
      ) : null}
    </div>
  )
}
