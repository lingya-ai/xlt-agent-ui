'use client'

import ExcelJS from 'exceljs'
import {useEffect, useState} from 'react'
import {useAgentMessages} from '../../../i18n/runtime'
import {cn} from '../../../ui/lib/utils'
import {ScrollArea} from '../../../ui/components/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/components/table'
import {Tabs, TabsList, TabsTrigger} from '../../../ui/components/tabs'
import type {PreviewerProps} from '../../types'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'
import {normalizeExcelComments} from '../../utils/normalize-excel-comments'

export type ExcelPreviewProps = PreviewerProps

interface CellData {
  value: string
  isHeader?: boolean
  colSpan?: number
  rowSpan?: number
}

interface SheetData {
  name: string
  rows: CellData[][]
  maxCols: number
}

/**
 * Excel (.xlsx/.xls) 预览器（基于 exceljs）
 */
export function ExcelPreview({source, config, className}: ExcelPreviewProps) {
  const t = useAgentMessages('excel-preview')
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const previewState = usePreviewControls({zoom: config.initialZoom ?? 1})

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(undefined)

    const workbook = new ExcelJS.Workbook()
    normalizeExcelComments(source)
      .then((normalized) => workbook.xlsx.load(normalized))
      .then((wb) => {
        if (cancelled) return
        const parsed: SheetData[] = wb.worksheets.map((sheet) => parseSheet(sheet))
        setSheets(parsed)
        setActiveSheet(0)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [source])

  if (loading) {
    console.log('[ExcelPreview] -> PreviewLoading')
    return <PreviewLoading className={className}/>
  }
  if (error) {
    console.log('[ExcelPreview] -> PreviewError', {error})
    return <PreviewError error={error} variant="parse" className={className}/>
  }
  if (sheets.length === 0) {
    return <PreviewError variant="parse" className={className}/>
  }

  const current = sheets[activeSheet] ?? sheets[0]!

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      {sheets.length > 1 ? (
        <Tabs
          value={String(activeSheet)}
          onValueChange={(v) => setActiveSheet(Number(v))}
          className="border-b bg-background/95"
        >
          <div className="w-full overflow-x-auto">
            <TabsList className="bg-transparent h-9 rounded-none p-0">
              {sheets.map((sheet, idx) => (
                <TabsTrigger
                  key={idx}
                  value={String(idx)}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  {sheet.name || `${t.sheetSwitch} ${idx + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      ) : null}

      <ScrollArea
        type="auto"
        horizontalScrollbar
        className="flex-1 min-h-0 min-w-0 bg-muted/20"
      >
        <div
          className="p-4"
          style={{
            zoom: previewState.zoom,
          }}
        >
          <Table
            containerClassName="w-max min-w-full overflow-visible"
            className="w-max min-w-full bg-background border"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center text-muted-foreground sticky left-0 bg-background">
                  #
                </TableHead>
                {Array.from({length: current.maxCols}).map((_, col) => (
                  <TableHead
                    key={col}
                    className="text-center text-muted-foreground min-w-[100px]"
                  >
                    {columnLabel(col)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  <TableCell className="text-center text-muted-foreground sticky left-0 bg-background">
                    {rowIdx + 1}
                  </TableCell>
                  {Array.from({length: current.maxCols}).map((_, col) => {
                    const cell = row[col]
                    if (!cell) {
                      return <TableCell key={col} className="min-w-[100px]"/>
                    }
                    return (
                      <TableCell
                        key={col}
                        colSpan={cell.colSpan ?? 1}
                        className={cn(
                          'min-w-[100px]',
                          cell.isHeader && 'font-semibold bg-muted/50',
                        )}
                      >
                        {cell.value}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * 将 ExcelJS Worksheet 解析为可渲染数据
 */
function parseSheet(sheet: ExcelJS.Worksheet): SheetData {
  const rows: CellData[][] = []
  let maxCols = 0

  sheet.eachRow({includeEmpty: true}, (row, rowNum) => {
    const cells: CellData[] = []
    row.eachCell({includeEmpty: true}, (cell, colNumber) => {
      const value = formatCellValue(cell)
      cells[colNumber - 1] = {
        value,
        isHeader: rowNum === 1,
      }
      if (colNumber > maxCols) maxCols = colNumber
    })
    rows.push(cells)
  })

  // 处理合并单元格（ExcelJS model.merges 是 "A1:B2" 格式的字符串数组）
  sheet.model?.merges?.forEach((mergeRef: string) => {
    const range = parseMergeRange(mergeRef)
    if (!range) return
    const {top, left, bottom, right} = range
    const row = rows[top - 1]
    if (row && row[left - 1]) {
      row[left - 1]!.colSpan = right - left + 1
      // 清空被合并的单元格
      for (let c = left; c < right; c++) {
        if (row[c]) row[c] = {...row[c]!, value: ''}
      }
    }
    // 跨行合并：清空下方被覆盖的单元格
    for (let r = top + 1; r <= bottom; r++) {
      const targetRow = rows[r - 1]
      if (!targetRow) continue
      for (let c = left; c <= right; c++) {
        if (targetRow[c]) targetRow[c] = {...targetRow[c]!, value: ''}
      }
    }
  })

  return {
    name: sheet.name,
    rows,
    maxCols,
  }
}

function formatCellValue(cell: ExcelJS.Cell): string {
  const value = cell.value
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'object') {
    // Hyperlink
    if ('text' in value && typeof (value as { text: unknown }).text === 'string') {
      return (value as { text: string }).text
    }
    // RichText
    if ('richText' in value && Array.isArray((value as { richText: unknown[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join('')
    }
    // Formula result
    if ('result' in value) {
      const result = (value as { result: unknown }).result
      return result === null || result === undefined ? '' : String(result)
    }
  }
  return String(value)
}

/**
 * 列索引转字母（0 -> A, 26 -> AA）
 */
function columnLabel(index: number): string {
  let label = ''
  let n = index
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  }
  return label
}

/**
 * 解析 ExcelJS 合并区域字符串（如 "A1:B2"）为行列范围
 * @returns 行列范围；解析失败返回 null
 */
function parseMergeRange(ref: string): { top: number; left: number; bottom: number; right: number } | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase())
  if (!match) return null
  const [, startCol, startRow, endCol, endRow] = match
  if (!startCol || !startRow || !endCol || !endRow) return null
  return {
    top: Number(startRow),
    left: letterToIndex(startCol),
    bottom: Number(endRow),
    right: letterToIndex(endCol),
  }
}

/**
 * 列字母转 0 基索引（A -> 0, Z -> 25, AA -> 26）
 */
function letterToIndex(letters: string): number {
  let index = 0
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64)
  }
  return index - 1
}
