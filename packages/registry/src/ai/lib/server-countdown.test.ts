import {describe, expect, it} from "vitest"

import {
  createServerCountdown,
  createTimeoutAt,
  getInitialServerRemainingMs,
} from "./server-countdown"

describe("服务端倒计时", () => {
  const timing = {
    serverNow: "2026-08-03T00:00:00.000Z",
    timeoutAt: "2026-08-03T00:30:00.000Z",
  }

  it("实时事件的初始剩余时间由服务端时间计算", () => {
    expect(getInitialServerRemainingMs(
      timing,
      () => Date.parse(timing.serverNow),
    )).toBe(30 * 60 * 1000)
  })

  it("历史回放会扣除 serverNow 之后已经过去的时间", () => {
    expect(getInitialServerRemainingMs(
      timing,
      () => Date.parse("2026-08-03T00:10:00.000Z"),
    )).toBe(20 * 60 * 1000)
  })

  it("使用单调时钟递减，不读取用户设备系统时间", () => {
    let monotonicTime = 100
    const countdown = createServerCountdown(
      timing,
      () => monotonicTime,
      () => Date.parse(timing.serverNow),
    )

    monotonicTime += 1_250
    expect(countdown.remainingMs()).toBe(30 * 60 * 1000 - 1_250)
    expect(countdown.remainingSeconds()).toBe(1_799)
    expect(countdown.isTimeout()).toBe(false)

    monotonicTime += 30 * 60 * 1000
    expect(countdown.remainingMs()).toBe(0)
    expect(countdown.isTimeout()).toBe(true)
  })

  it("可由服务端事件时间和超时秒数推导截止时间", () => {
    expect(createTimeoutAt(timing.serverNow, 90)).toBe("2026-08-03T00:01:30.000Z")
  })

  it("基于服务端纳秒精度时间计算剩余时间", () => {
    const serverNow = "2026-09-12T10:52:53.781484300Z"
    const timeoutAt = createTimeoutAt(serverNow, 1_800)

    expect(timeoutAt).toBe("2026-09-12T11:22:53.781Z")
    expect(getInitialServerRemainingMs(
      {serverNow, timeoutAt},
      () => Date.parse(serverNow),
    )).toBe(1_800_000)
  })

  it("历史事件缺少 serverNow 时，以当前时间初始化倒计时", () => {
    expect(getInitialServerRemainingMs({
      serverNow: "",
      timeoutAt: timing.timeoutAt,
    }, () => Date.parse("2026-08-03T00:20:00.000Z"))).toBe(10 * 60 * 1000)

    expect(createTimeoutAt("", 90, () => Date.parse(timing.serverNow)))
      .toBe("2026-08-03T00:01:30.000Z")
  })

  it("截止时间无效或已过时，直接视为超时", () => {
    expect(getInitialServerRemainingMs({
      serverNow: timing.serverNow,
      timeoutAt: "invalid",
    })).toBe(0)
    expect(getInitialServerRemainingMs({
      serverNow: timing.timeoutAt,
      timeoutAt: timing.serverNow,
    })).toBe(0)
  })
})
