import {describe, expect, it} from "vitest"

import {formatCompactToken, parseTokenKInput, tokenCountToK} from "./token"

describe("formatCompactToken", () => {
  it("将大额 Token 格式化为最多一位小数的紧凑单位", () => {
    expect(formatCompactToken(1_234)).toBe("1.2K")
    expect(formatCompactToken(12_345)).toBe("12.3K")
  })

  it("保留不足一千的 Token 数值", () => {
    expect(formatCompactToken(999)).toBe("999")
  })

  it("使用十进制 K 和 M 阈值", () => {
    expect(formatCompactToken(1_000)).toBe("1K")
    expect(formatCompactToken(1_000_000)).toBe("1M")
  })
})

describe("token K 输入转换", () => {
  it("在显示值和存储值之间使用 1000 换算", () => {
    expect(tokenCountToK(64_000)).toBe(64)
    expect(parseTokenKInput("64")).toBe(64_000)
    expect(parseTokenKInput("1.234")).toBe(1_234)
  })

  it("拒绝空值、负数和非有限值", () => {
    expect(parseTokenKInput("")).toBeUndefined()
    expect(parseTokenKInput("-1")).toBeUndefined()
    expect(parseTokenKInput("Infinity")).toBeUndefined()
  })
})
