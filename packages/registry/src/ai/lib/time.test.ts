import {describe, expect, it} from "vitest"

import {formatDuration, formatWorkingDuration} from "./time"

describe("formatDuration", () => {
  it("不足一秒时显示毫秒", () => {
    expect(formatDuration(0)).toBe("0ms")
    expect(formatDuration(328)).toBe("328ms")
    expect(formatDuration(999)).toBe("999ms")
  })

  it("达到一秒后继续使用秒级时长格式", () => {
    expect(formatDuration(1_000)).toBe("1s")
    expect(formatDuration(65_000)).toBe("1m 5s")
  })
})

describe("formatWorkingDuration", () => {
  it("根据开始与当前单调时间格式化时长", () => {
    expect(formatWorkingDuration(0, 1_861_000)).toBe("31m 1s")
  })

  it("当前时间早于开始时间时返回零时长", () => {
    expect(formatWorkingDuration(1_000, 0)).toBe("0ms")
  })
})
