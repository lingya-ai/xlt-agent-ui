"use client"

import {useState} from "react"

import {useAgentMessages} from "../../i18n/runtime"

import {Alert, AlertDescription} from "../../ui/components/alert"
import {Button} from "../../ui/components/button"
import {cn} from "../../ui/lib/utils"
import {Empty, EmptyDescription} from "../../ui/components/empty"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../../ui/components/pagination"
import {Skeleton} from "../../ui/components/skeleton"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/components/table"

import {useSqlQueryResultRequest} from "../hooks/use-chat/use-sql-query-result"
import {useAiChatContext} from "./context"

const DEFAULT_PAGE_SIZE = 100

interface SqlQueryDataTableResult {
  resultId: string
  rowCount: number
  columns: string[]
}

interface SqlQueryDataTableProps {
  conversationId: string
  result: SqlQueryDataTableResult
}

/** 仅在挂载时请求并展示 SQL 分页数据表。 */
export function SqlQueryDataTable({conversationId, result}: SqlQueryDataTableProps) {
  const t = useAgentMessages("sql-query-data-table")
  const {httpClient} = useAiChatContext()
  const [current, setCurrent] = useState(0)
  const {data, loading, error, refresh} = useSqlQueryResultRequest(
    httpClient,
    conversationId,
    result.resultId,
    current,
    DEFAULT_PAGE_SIZE
  )
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-2 p-3" aria-label={t.loading.value}>
        <Skeleton className="h-8 w-full"/>
        <Skeleton className="h-40 w-full"/>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-3 w-auto">
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{t.loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            {t.retry}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const records = data?.records ?? []
  const columns = data?.columns ?? result.columns
  const total = data?.total ?? result.rowCount
  const displayCurrent = data?.current ?? current
  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE)
  const rangeStart = total === 0 ? 0 : displayCurrent * DEFAULT_PAGE_SIZE + 1
  const rangeEnd = Math.min((displayCurrent + 1) * DEFAULT_PAGE_SIZE, total)

  if (records.length === 0) {
    return (
      <Empty className="min-h-40">
        <EmptyDescription>{t.empty}</EmptyDescription>
      </Empty>
    )
  }

  const handlePrevious = () => {
    if (loading || current <= 0) return
    setCurrent((page) => page - 1)
  }

  const handleNext = () => {
    if (loading || current >= totalPages - 1) return
    setCurrent((page) => page + 1)
  }

  const previousDisabled = loading || current <= 0
  const nextDisabled = loading || current >= totalPages - 1

  return (
    <div className="min-w-0">
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow>
              {columns.map((column, columnIndex) => (
                <TableHead key={`${column}-${columnIndex}`} className="max-w-80 bg-muted/60">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record, rowIndex) => {
              const absoluteRowIndex = displayCurrent * DEFAULT_PAGE_SIZE + rowIndex
              return (
                <TableRow key={`sql-row-${absoluteRowIndex}`}>
                  {columns.map((column, columnIndex) => {
                    const value = record.values[columnIndex] ?? null
                    return (
                      <TableCell
                        key={`${absoluteRowIndex}-${column}-${columnIndex}`}
                        className="max-w-80 whitespace-pre-wrap break-words align-top"
                      >
                        {value == null ? (
                          <span className="font-mono text-xs italic text-muted-foreground">{t.nullValue}</span>
                        ) : value}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border px-3 py-2">
        {totalPages > 1 ? (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-disabled={previousDisabled}
                  className={cn(previousDisabled ? "pointer-events-none opacity-50" : "cursor-pointer")}
                  onClick={(event) => {
                    event.preventDefault()
                    handlePrevious()
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={nextDisabled}
                  className={cn(nextDisabled ? "pointer-events-none opacity-50" : "cursor-pointer")}
                  onClick={(event) => {
                    event.preventDefault()
                    handleNext()
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
        <span className="text-right text-xs text-muted-foreground">
          {t.range({start: rangeStart, end: rangeEnd, total})}
        </span>
      </div>
    </div>
  )
}
