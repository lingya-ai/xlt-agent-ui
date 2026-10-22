import type {
  ChartCategoryDatum,
  ChartCategoryFormatterContext,
  ChartSeriesBase,
  ChartValueDatum,
  ChartValueFormatterContext,
} from "../types/chart"

interface TooltipParam {
  dataIndex: number
  seriesIndex: number
}

interface TooltipFormatterInput {
  categories: readonly ChartCategoryDatum[]
  series: readonly ChartSeriesBase[]
  formatCategory?: (context: ChartCategoryFormatterContext) => string
  formatValue?: (context: ChartValueFormatterContext) => string
  onError?: (error: Error) => void
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function isTooltipParam(value: unknown): value is TooltipParam {
  if (!value || typeof value !== "object") return false
  const candidate = value as {dataIndex?: unknown; seriesIndex?: unknown}
  return Number.isInteger(candidate.dataIndex) && Number.isInteger(candidate.seriesIndex)
}

function defaultFormatCategory(datum: ChartCategoryDatum): string {
  return datum.label
}

function defaultFormatValue(datum: ChartValueDatum): string {
  if (datum.rawValue != null) return String(datum.rawValue)
  if (datum.value != null) return String(datum.value)
  return "—"
}

export function safelyFormatCategory(
  datum: ChartCategoryDatum,
  dataIndex: number,
  formatter: TooltipFormatterInput["formatCategory"],
  onError?: (error: Error) => void
): string {
  if (!formatter) return defaultFormatCategory(datum)

  try {
    return formatter({datum, dataIndex})
  } catch (error) {
    onError?.(toError(error))
    return defaultFormatCategory(datum)
  }
}

export function safelyFormatValue(
  datum: ChartValueDatum,
  category: ChartCategoryDatum,
  series: ChartSeriesBase,
  dataIndex: number,
  formatter: TooltipFormatterInput["formatValue"],
  onError?: (error: Error) => void
): string {
  if (!formatter) return defaultFormatValue(datum)

  try {
    return formatter({datum, category, series, dataIndex})
  } catch (error) {
    onError?.(toError(error))
    return defaultFormatValue(datum)
  }
}

/** 构造只返回 Canvas rich text 的固定 tooltip formatter。 */
export function buildTooltipFormatter(input: TooltipFormatterInput): (params: unknown) => string {
  return (params: unknown): string => {
    const records = (Array.isArray(params) ? params : [params]).filter(isTooltipParam)
    const firstRecord = records[0]
    if (!firstRecord) return ""

    const category = input.categories[firstRecord.dataIndex]
    if (!category) return ""

    const lines = [
      safelyFormatCategory(category, firstRecord.dataIndex, input.formatCategory, input.onError),
    ]

    for (const record of records) {
      const series = input.series[record.seriesIndex]
      const datum = series?.values[record.dataIndex]
      if (!series || !datum) continue

      lines.push(
        `${series.name}: ${safelyFormatValue(
          datum,
          category,
          series,
          record.dataIndex,
          input.formatValue,
          input.onError
        )}`
      )
    }

    return lines.join("\n")
  }
}
