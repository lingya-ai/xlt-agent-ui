import {describe, expect, it} from "vitest"

import type {
  ChartSpecV1,
  ExcelSqlChartColumn,
  ExcelSqlChartDataset,
  SqlChartResultContent,
  SqlResultColumn,
} from "../hooks/use-chat/schema"
import {
  SQL_CHART_VALIDATION_REASON,
  toWorkspaceChartModel,
  validateSqlChartDataset,
} from "./sql-chart-adapter"

const schema: SqlResultColumn[] = [
  {name: "period", type: "STRING", nullable: false},
  {name: "revenue", type: "DECIMAL", nullable: true, precision: 18, scale: 2},
  {name: "growth", type: "DOUBLE", nullable: true},
]

const dataset: ExcelSqlChartDataset = {
  resultId: "result-1",
  rowCount: 2,
  schema,
  columns: [
    {name: "period", type: "STRING", values: ["2026-01", "2026-02"]},
    {name: "revenue", type: "DECIMAL", values: ["123456789012345.67", null]},
    {name: "growth", type: "DOUBLE", values: [0.125, 0.2]},
  ],
}

const spec: ChartSpecV1 = {
  version: 1,
  type: "BAR_LINE",
  title: "Revenue",
  subtitle: null,
  categoryColumn: "period",
  categoryType: "CATEGORY",
  orientation: "VERTICAL",
  legend: true,
  dataZoom: "NONE",
  nullPolicy: "ZERO",
  series: [
    {
      name: "Revenue",
      valueColumn: "revenue",
      renderType: "BAR",
      axis: "PRIMARY",
      numberFormat: {type: "NUMBER", decimalPlaces: 2},
    },
    {
      name: "Growth",
      valueColumn: "growth",
      renderType: "LINE",
      axis: "SECONDARY",
      numberFormat: {type: "PERCENT", decimalPlaces: 1, valueScale: "FRACTION"},
    },
  ],
}

const content: SqlChartResultContent = {
  resultId: "result-1",
  rowCount: 2,
  columnCount: 3,
  columns: ["period", "revenue", "growth"],
  schema,
  chart: spec,
  qualitySummary: {nullValueCount: 1, nullValueColumns: ["revenue"], zeroFilledValueCount: 1},
  timeContext: {asOfInstant: new Date("2026-07-23T00:00:00Z"), tenantZoneId: "Asia/Shanghai"},
}

const adapterOptions = {
  locale: "en-US",
  messages: {nullValue: "NULL", zeroFilledSuffix: " (missing as 0)"},
}

describe("validateSqlChartDataset", () => {
  it("接受顺序、Schema 和数值均一致的数据集", () => {
    expect(validateSqlChartDataset(content, spec, dataset, "en-US")).toEqual({ok: true})
  })

  it("拒绝超过浏览器安全绘图范围的 DECIMAL", () => {
    const unsafeDataset: ExcelSqlChartDataset = {
      ...dataset,
      columns: dataset.columns.map((column): ExcelSqlChartColumn =>
        column.name === "revenue"
          ? {
              name: column.name,
              type: "DECIMAL",
              values: ["9007199254740992.01", null],
            }
          : column,
      ),
    }

    expect(validateSqlChartDataset(content, spec, unsafeDataset, "en-US")).toEqual({
      ok: false,
      reason: SQL_CHART_VALIDATION_REASON.NUMBER_UNSAFE,
      column: "revenue",
    })
  })

  it("REJECT 策略遇到 null 时拒绝绘图", () => {
    expect(validateSqlChartDataset(content, {...spec, nullPolicy: "REJECT"}, dataset, "en-US")).toEqual({
      ok: false,
      reason: SQL_CHART_VALIDATION_REASON.NULL_REJECTED,
      column: "revenue",
    })
  })
})

describe("toWorkspaceChartModel", () => {
  it("保持 SQL 行顺序并生成双轴柱线模型", () => {
    const model = toWorkspaceChartModel(spec, dataset, adapterOptions)

    expect(model.kind).toBe("bar-line")
    expect(model.categories.map((category) => category.label)).toEqual(["2026-01", "2026-02"])
    if (model.kind !== "bar-line") throw new Error("unexpected model kind")
    expect(model.series).toMatchObject([
      {type: "bar", axis: "primary", values: [{value: 123456789012345.67}, {value: 0, wasNull: true}]},
      {type: "line", axis: "secondary", values: [{value: 0.125}, {value: 0.2}]},
    ])
  })

  it("tooltip 使用 DECIMAL 原始字符串并正确格式化百分比", () => {
    const model = toWorkspaceChartModel(spec, dataset, adapterOptions)
    if (model.kind !== "bar-line") throw new Error("unexpected model kind")
    const category = model.categories[0]!

    expect(model.formatValue({
      datum: model.series[0]!.values[0]!,
      category,
      series: model.series[0]!,
      dataIndex: 0,
    })).toBe("123,456,789,012,345.67")
    expect(model.formatValue({
      datum: model.series[1]!.values[0]!,
      category,
      series: model.series[1]!,
      dataIndex: 0,
    })).toBe("12.5%")
  })

  it("ZERO 策略保留 wasNull 并增加本地化说明", () => {
    const model = toWorkspaceChartModel(spec, dataset, adapterOptions)
    if (model.kind !== "bar-line") throw new Error("unexpected model kind")

    expect(model.formatValue({
      datum: model.series[0]!.values[1]!,
      category: model.categories[1]!,
      series: model.series[0]!,
      dataIndex: 1,
    })).toBe("0.00 (missing as 0)")
  })
})
