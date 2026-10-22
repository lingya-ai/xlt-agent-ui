import {describe, expect, it} from "vitest"

import {
  ensureDownloadFileExtension,
  sanitizeDownloadFileName,
} from "./browser-download"

describe("browser-download", () => {
  it("清理文件名中的路径分隔符和系统保留字符", () => {
    expect(sanitizeDownloadFileName('  2025/季度:<金额>?*.csv  ', "fallback"))
      .toBe("2025-季度--金额---.csv")
  })

  it("文件名清理后为空时使用回退名称", () => {
    expect(sanitizeDownloadFileName("...   ", "sql-query-result")).toBe("sql-query-result")
  })

  it("仅在缺少扩展名时补齐并忽略大小写", () => {
    expect(ensureDownloadFileExtension("result", "csv")).toBe("result.csv")
    expect(ensureDownloadFileExtension("result.XLSX", ".xlsx")).toBe("result.XLSX")
  })
})
