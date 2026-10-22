import type {
  ChartBarLineSeries,
  ChartBarSeries,
  ChartCategoryDatum,
  ChartLineSeries,
  ChartPieSeries,
  ChartStackedBarSeries,
  ChartValueDatum,
  ChartValueFormatterContext,
} from "../../charts/types/chart"

import {
  type ChartNumberFormat,
  type ChartSeries,
  type ChartSpecV1,
  type ExcelSqlChartColumn,
  type ExcelSqlChartDataset,
  type SqlChartResultContent,
  type SqlColumnType,
  type SqlResultColumn,
} from "../hooks/use-chat/schema"

const NUMERIC_COLUMN_TYPES: ReadonlySet<SqlColumnType> = new Set(["INTEGER", "LONG", "DECIMAL", "DOUBLE"])
const DECIMAL_PATTERN = /^[+-]?\d+(?:\.\d+)?$/
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/

export const SQL_CHART_VALIDATION_REASON = {
  RESULT_ID_MISMATCH: "result-id-mismatch",
  ROW_COUNT_MISMATCH: "row-count-mismatch",
  COLUMN_COUNT_MISMATCH: "column-count-mismatch",
  COLUMN_SCHEMA_MISMATCH: "column-schema-mismatch",
  DUPLICATE_COLUMN: "duplicate-column",
  COLUMN_LENGTH_MISMATCH: "column-length-mismatch",
  CATEGORY_COLUMN_MISSING: "category-column-missing",
  VALUE_COLUMN_MISSING: "value-column-missing",
  VALUE_COLUMN_NOT_NUMERIC: "value-column-not-numeric",
  CHART_SERIES_INVALID: "chart-series-invalid",
  STACK_INVALID: "stack-invalid",
  NULL_REJECTED: "null-rejected",
  DECIMAL_INVALID: "decimal-invalid",
  NUMBER_UNSAFE: "number-unsafe",
  NUMBER_FORMAT_INVALID: "number-format-invalid",
} as const

export type SqlChartValidationReason =
  typeof SQL_CHART_VALIDATION_REASON[keyof typeof SQL_CHART_VALIDATION_REASON]

export type SqlChartValidationResult =
  | { ok: true }
  | { ok: false; reason: SqlChartValidationReason; column?: string }

export interface SqlChartAdapterMessages {
  nullValue: string
  zeroFilledSuffix: string
}

export interface SqlChartAdapterOptions {
  locale: string
  messages: SqlChartAdapterMessages
  tenantZoneId?: string | null
}

interface WorkspaceChartCommonModel {
  categories: readonly ChartCategoryDatum[]
  title?: string
  subtitle?: string
  showLegend: boolean
  dataZoom: "none" | "auto"
  orientation: "vertical" | "horizontal"
  formatValue: (context: ChartValueFormatterContext) => string
}

export type WorkspaceSqlChartModel =
  | (WorkspaceChartCommonModel & { kind: "bar"; series: readonly ChartBarSeries[] })
  | (WorkspaceChartCommonModel & { kind: "line"; series: readonly ChartLineSeries[] })
  | (WorkspaceChartCommonModel & { kind: "bar-line"; series: readonly ChartBarLineSeries[] })
  | (WorkspaceChartCommonModel & { kind: "stacked-bar"; series: readonly ChartStackedBarSeries[] })
  | (Omit<WorkspaceChartCommonModel, "orientation"> & { kind: "pie"; series: ChartPieSeries })

function failure(reason: SqlChartValidationReason, column?: string): SqlChartValidationResult {
  return column ? {ok: false, reason, column} : {ok: false, reason}
}

function schemasMatch(left: SqlResultColumn, right: SqlResultColumn): boolean {
  return left.name === right.name &&
    left.type === right.type &&
    left.nullable === right.nullable &&
    (left.precision ?? null) === (right.precision ?? null) &&
    (left.scale ?? null) === (right.scale ?? null)
}

function isNumberFormatValid(format: ChartNumberFormat, locale: string): boolean {
  if (!Number.isInteger(format.decimalPlaces) || format.decimalPlaces < 0 || format.decimalPlaces > 20) {
    return false
  }
  if (format.type === "PERCENT" && !format.valueScale) return false
  if (format.type !== "CURRENCY") return true
  if (!format.currency || !CURRENCY_PATTERN.test(format.currency)) return false

  try {
    new Intl.NumberFormat(locale, {style: "currency", currency: format.currency})
    return true
  } catch {
    return false
  }
}

function isChartSeriesShapeValid(spec: ChartSpecV1): boolean {
  switch (spec.type) {
    case "BAR":
      return spec.series.every((series) => series.renderType === "BAR")
    case "LINE":
      return spec.series.every((series) => series.renderType === "LINE")
    case "BAR_LINE":
      return spec.series.every((series) => series.renderType === "BAR" || series.renderType === "LINE")
    case "STACKED_BAR":
      return spec.series.every((series) => series.renderType === "BAR" && Boolean(series.stack?.trim()))
    case "PIE":
      return spec.series.length === 1 && spec.series[0]?.renderType === "PIE"
  }
}

/** 在绘图前校验元数据、列顺序、数值安全与 ChartSpec 约束。 */
export function validateSqlChartDataset(
  content: SqlChartResultContent,
  spec: ChartSpecV1,
  dataset: ExcelSqlChartDataset,
  locale: string
): SqlChartValidationResult {
  if (dataset.resultId !== content.resultId) return failure(SQL_CHART_VALIDATION_REASON.RESULT_ID_MISMATCH)
  if (dataset.rowCount !== content.rowCount) return failure(SQL_CHART_VALIDATION_REASON.ROW_COUNT_MISMATCH)
  if (
    content.columnCount !== content.columns.length ||
    content.columnCount !== content.schema.length ||
    content.columnCount !== dataset.schema.length ||
    content.columnCount !== dataset.columns.length
  ) {
    return failure(SQL_CHART_VALIDATION_REASON.COLUMN_COUNT_MISMATCH)
  }

  const names = new Set<string>()
  for (let index = 0; index < content.columnCount; index += 1) {
    const contentName = content.columns[index]
    const contentSchema = content.schema[index]
    const datasetSchema = dataset.schema[index]
    const datasetColumn = dataset.columns[index]
    if (!contentName || !contentSchema || !datasetSchema || !datasetColumn) {
      return failure(SQL_CHART_VALIDATION_REASON.COLUMN_SCHEMA_MISMATCH)
    }
    if (names.has(contentName)) return failure(SQL_CHART_VALIDATION_REASON.DUPLICATE_COLUMN, contentName)
    names.add(contentName)
    if (
      contentName !== contentSchema.name ||
      contentName !== datasetColumn.name ||
      !schemasMatch(contentSchema, datasetSchema) ||
      contentSchema.type !== datasetColumn.type
    ) {
      return failure(SQL_CHART_VALIDATION_REASON.COLUMN_SCHEMA_MISMATCH, contentName)
    }
    if (datasetColumn.values.length !== dataset.rowCount) {
      return failure(SQL_CHART_VALIDATION_REASON.COLUMN_LENGTH_MISMATCH, contentName)
    }
  }

  const columnMap = new Map(dataset.columns.map((column) => [column.name, column]))
  if (!columnMap.has(spec.categoryColumn)) {
    return failure(SQL_CHART_VALIDATION_REASON.CATEGORY_COLUMN_MISSING, spec.categoryColumn)
  }
  if (!isChartSeriesShapeValid(spec)) {
    const reason = spec.type === "STACKED_BAR"
      ? SQL_CHART_VALIDATION_REASON.STACK_INVALID
      : SQL_CHART_VALIDATION_REASON.CHART_SERIES_INVALID
    return failure(reason)
  }

  for (const series of spec.series) {
    const column = columnMap.get(series.valueColumn)
    if (!column) return failure(SQL_CHART_VALIDATION_REASON.VALUE_COLUMN_MISSING, series.valueColumn)
    if (!NUMERIC_COLUMN_TYPES.has(column.type)) {
      return failure(SQL_CHART_VALIDATION_REASON.VALUE_COLUMN_NOT_NUMERIC, series.valueColumn)
    }
    if (!isNumberFormatValid(series.numberFormat, locale)) {
      return failure(SQL_CHART_VALIDATION_REASON.NUMBER_FORMAT_INVALID, series.valueColumn)
    }

    for (const rawValue of column.values) {
      if (rawValue == null) {
        if (spec.nullPolicy === "REJECT") {
          return failure(SQL_CHART_VALIDATION_REASON.NULL_REJECTED, series.valueColumn)
        }
        continue
      }
      if (column.type === "DECIMAL") {
        if (typeof rawValue !== "string" || !DECIMAL_PATTERN.test(rawValue)) {
          return failure(SQL_CHART_VALIDATION_REASON.DECIMAL_INVALID, series.valueColumn)
        }
        const geometryValue = Number(rawValue)
        if (!Number.isFinite(geometryValue) || Math.abs(geometryValue) > Number.MAX_SAFE_INTEGER) {
          return failure(SQL_CHART_VALIDATION_REASON.NUMBER_UNSAFE, series.valueColumn)
        }
      } else if (column.type === "INTEGER" || column.type === "LONG") {
        if (typeof rawValue !== "number" || !Number.isSafeInteger(rawValue)) {
          return failure(SQL_CHART_VALIDATION_REASON.NUMBER_UNSAFE, series.valueColumn)
        }
      } else if (column.type === "DOUBLE") {
        if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
          return failure(SQL_CHART_VALIDATION_REASON.NUMBER_UNSAFE, series.valueColumn)
        }
      }
    }
  }

  return {ok: true}
}

function findColumn(dataset: ExcelSqlChartDataset, name: string): ExcelSqlChartColumn {
  const column = dataset.columns.find((candidate) => candidate.name === name)
  if (!column) throw new Error(`Validated chart column is missing: ${name}`)
  return column
}

function formatInstant(value: Date | string, locale: string, tenantZoneId?: string | null): string {
  const raw = value instanceof Date ? value.toISOString() : value
  if (!tenantZoneId) return raw
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tenantZoneId,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date)
  } catch {
    return raw
  }
}

function formatCategoryValue(
  raw: string | number | boolean | Date | null,
  type: SqlColumnType,
  options: SqlChartAdapterOptions
): string {
  if (raw == null) return options.messages.nullValue
  if (type === "INSTANT" && (typeof raw === "string" || raw instanceof Date)) {
    return formatInstant(raw, options.locale, options.tenantZoneId)
  }
  return String(raw)
}

function decimalShiftRight(raw: string, places: number): string {
  const negative = raw.startsWith("-")
  const unsigned = raw.replace(/^[+-]/, "")
  const [whole = "0", fraction = ""] = unsigned.split(".")
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0"
  const currentScale = fraction.length
  const nextScale = currentScale - places
  let shifted: string
  if (nextScale <= 0) {
    shifted = `${digits}${"0".repeat(-nextScale)}`
  } else {
    const padded = digits.padStart(nextScale + 1, "0")
    shifted = `${padded.slice(0, -nextScale)}.${padded.slice(-nextScale)}`
  }
  return negative && shifted !== "0" ? `-${shifted}` : shifted
}

function roundDecimal(raw: string, decimalPlaces: number): { negative: boolean; whole: string; fraction: string } {
  const negative = raw.startsWith("-")
  const unsigned = raw.replace(/^[+-]/, "")
  const [whole = "0", fraction = ""] = unsigned.split(".")
  const paddedFraction = fraction.padEnd(decimalPlaces + 1, "0")
  const retainedFraction = paddedFraction.slice(0, decimalPlaces)
  const shouldRound = Number(paddedFraction[decimalPlaces] ?? "0") >= 5
  const scaleDigits = `${whole}${retainedFraction}`.replace(/^0+(?=\d)/, "") || "0"
  const roundedDigits = (BigInt(scaleDigits) + (shouldRound ? 1n : 0n)).toString()
    .padStart(decimalPlaces + 1, "0")
  const roundedWhole = decimalPlaces === 0 ? roundedDigits : roundedDigits.slice(0, -decimalPlaces)
  const roundedFraction = decimalPlaces === 0 ? "" : roundedDigits.slice(-decimalPlaces)
  const isZero = /^0+$/.test(roundedWhole) && /^0*$/.test(roundedFraction)
  return {negative: negative && !isZero, whole: roundedWhole, fraction: roundedFraction}
}

function getNumberSymbols(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000.1)
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  }
}

function formatExactNumber(raw: string, decimalPlaces: number, locale: string): {
  signed: string;
  unsigned: string;
  negative: boolean
} {
  const rounded = roundDecimal(raw, decimalPlaces)
  const symbols = getNumberSymbols(locale)
  const groupedWhole = rounded.whole.replace(/\B(?=(\d{3})+(?!\d))/g, symbols.group)
  const unsigned = rounded.fraction
    ? `${groupedWhole}${symbols.decimal}${rounded.fraction}`
    : groupedWhole
  return {
    negative: rounded.negative,
    signed: rounded.negative ? `-${unsigned}` : unsigned,
    unsigned,
  }
}

function placeNumberInIntlParts(parts: Intl.NumberFormatPart[], number: {
  unsigned: string;
  negative: boolean
}): string {
  let inserted = false
  return parts.map((part) => {
    if (part.type === "minusSign") return number.negative ? part.value : ""
    if (["integer", "group", "decimal", "fraction"].includes(part.type)) {
      if (inserted) return ""
      inserted = true
      return number.unsigned
    }
    return part.value
  }).join("")
}

function formatNumericValue(rawValue: string | number, format: ChartNumberFormat, locale: string): string {
  if (typeof rawValue === "number") {
    if (format.type === "CURRENCY" && format.currency) {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: format.currency,
        minimumFractionDigits: format.decimalPlaces,
        maximumFractionDigits: format.decimalPlaces,
      }).format(rawValue)
    }
    if (format.type === "PERCENT") {
      const percentValue = format.valueScale === "ALREADY_PERCENT" ? rawValue / 100 : rawValue
      return new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: format.decimalPlaces,
        maximumFractionDigits: format.decimalPlaces,
      }).format(percentValue)
    }
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: format.decimalPlaces,
      maximumFractionDigits: format.decimalPlaces,
    }).format(rawValue)
  }

  let decimalRaw = String(rawValue)
  if (format.type === "PERCENT" && format.valueScale === "FRACTION") {
    decimalRaw = decimalShiftRight(decimalRaw, 2)
  }
  const exact = formatExactNumber(decimalRaw, format.decimalPlaces, locale)
  if (format.type === "NUMBER") return exact.signed

  if (format.type === "CURRENCY" && format.currency) {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: format.currency,
      minimumFractionDigits: format.decimalPlaces,
      maximumFractionDigits: format.decimalPlaces,
    }).formatToParts(exact.negative ? -0 : 0)
    return placeNumberInIntlParts(parts, exact)
  }

  const parts = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: format.decimalPlaces,
    maximumFractionDigits: format.decimalPlaces,
  }).formatToParts(exact.negative ? -0 : 0)
  return placeNumberInIntlParts(parts, exact)
}

function createValueDatum(
  rawValue: string | number | null,
  sourceIndex: number,
  nullPolicy: ChartSpecV1["nullPolicy"]
): ChartValueDatum {
  if (rawValue == null) {
    return {
      value: nullPolicy === "ZERO" ? 0 : null,
      rawValue: null,
      sourceIndex,
      wasNull: true,
    }
  }
  return {
    value: Number(rawValue),
    rawValue,
    sourceIndex,
  }
}

function createSeriesValues(column: ExcelSqlChartColumn, spec: ChartSpecV1): readonly ChartValueDatum[] {
  if (!NUMERIC_COLUMN_TYPES.has(column.type)) {
    throw new Error(`Validated numeric chart column has invalid type: ${column.type}`)
  }
  return column.values.map((value, sourceIndex) => {
    if (typeof value === "boolean" || value instanceof Date) throw new Error("Validated numeric chart column contains a boolean")
    return createValueDatum(value, sourceIndex, spec.nullPolicy)
  })
}

function createSeriesId(series: ChartSeries, index: number): string {
  return `${index}-${series.valueColumn}`
}

/** 将严格校验后的 SQL ChartSpec 与列式数据转换为 @workspace/charts 模型。 */
export function toWorkspaceChartModel(
  spec: ChartSpecV1,
  dataset: ExcelSqlChartDataset,
  options: SqlChartAdapterOptions
): WorkspaceSqlChartModel {
  const categoryColumn = findColumn(dataset, spec.categoryColumn)
  const categories = categoryColumn.values.map((value, sourceIndex) => ({
    key: `${sourceIndex}-${String(value ?? "null")}`,
    label: formatCategoryValue(value, categoryColumn.type, options),
    sourceIndex,
  }))
  const seriesFormats = new Map<string, ChartNumberFormat>()
  const commonSeries = spec.series.map((series, index) => {
    const id = createSeriesId(series, index)
    seriesFormats.set(id, series.numberFormat)
    return {
      id,
      name: series.name,
      axis: series.axis === "SECONDARY" ? "secondary" as const : "primary" as const,
      values: createSeriesValues(findColumn(dataset, series.valueColumn), spec),
    }
  })
  const formatValue = ({datum, series}: ChartValueFormatterContext): string => {
    if (datum.wasNull) {
      if (spec.nullPolicy === "ZERO") {
        const format = seriesFormats.get(series.id)
        const zero = format ? formatNumericValue(0, format, options.locale) : "0"
        return `${zero}${options.messages.zeroFilledSuffix}`
      }
      return options.messages.nullValue
    }
    const format = seriesFormats.get(series.id)
    if (!format || datum.rawValue == null) return options.messages.nullValue
    return formatNumericValue(datum.rawValue, format, options.locale)
  }
  const common = {
    categories,
    title: spec.title || undefined,
    subtitle: spec.subtitle ?? undefined,
    showLegend: spec.legend,
    dataZoom: spec.dataZoom === "AUTO" ? "auto" as const : "none" as const,
    orientation: spec.orientation === "HORIZONTAL" ? "horizontal" as const : "vertical" as const,
    formatValue,
  }

  switch (spec.type) {
    case "BAR":
      return {kind: "bar", ...common, series: commonSeries.map((series) => ({...series, type: "bar" as const}))}
    case "LINE":
      return {kind: "line", ...common, series: commonSeries.map((series) => ({...series, type: "line" as const}))}
    case "BAR_LINE":
      return {
        kind: "bar-line",
        ...common,
        series: commonSeries.map((series, index) => ({
          ...series,
          type: spec.series[index]?.renderType === "LINE" ? "line" as const : "bar" as const,
        })),
      }
    case "STACKED_BAR":
      return {
        kind: "stacked-bar",
        ...common,
        series: commonSeries.map((series, index) => ({
          ...series,
          type: "bar" as const,
          stackId: spec.series[index]?.stack ?? "",
        })),
      }
    case "PIE":
      return {
        kind: "pie",
        categories,
        title: common.title,
        subtitle: common.subtitle,
        showLegend: common.showLegend,
        dataZoom: common.dataZoom,
        formatValue,
        series: {...commonSeries[0]!, type: "pie"},
      }
  }
}
