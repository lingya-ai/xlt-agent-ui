/**
 * 服务端定义倒计时所需的时间信息。
 */
export interface ServerTimedPayload {
  /** 服务端生成事件时的 UTC 时间。 */
  serverNow: Date | string
  /** 服务端定义的截止 UTC 时间。 */
  timeoutAt: Date | string
}

/** 单调时钟读取函数，便于测试并避免依赖系统时钟。 */
type MonotonicNow = () => number

/** 系统时钟读取函数，仅用于兼容缺失服务端时间的历史事件。 */
type SystemNow = () => number

/** Java Instant 可保留纳秒，JavaScript Date 只保留毫秒，解析前先截断多余精度。 */
function parseServerInstant(value: Date | string): number {
  if (value instanceof Date) return value.getTime();
  const millisecondPrecisionValue = value.replace(
    /(\.\d{3})\d+(?=(?:Z|[+-]\d{2}:\d{2})$)/,
    "$1",
  )
  return Date.parse(millisecondPrecisionValue)
}

/**
 * 计算服务端定义的初始剩余毫秒数。
 *
 * 以 serverNow 限制最大剩余时间，并在历史回放时用当前时间扣除已经过去的时间。
 * 历史事件缺少 serverNow 时，仅在初始化阶段读取一次当前系统时间兜底。
 */
export function getInitialServerRemainingMs(
  {serverNow, timeoutAt}: ServerTimedPayload,
  getSystemNow: SystemNow = () => Date.now(),
): number {
  const serverNowMs = parseServerInstant(serverNow)
  const timeoutAtMs = parseServerInstant(timeoutAt)

  if (!Number.isFinite(timeoutAtMs)) {
    return 0
  }

  const systemNowMs = getSystemNow()
  const referenceNowMs = Number.isFinite(serverNowMs)
    ? Math.max(serverNowMs, systemNowMs)
    : systemNowMs

  return Math.max(0, timeoutAtMs - referenceNowMs)
}

/**
 * 根据服务端事件时间和超时秒数推导截止 UTC 时间。
 *
 * 历史事件未下发 serverNow 时，以接收事件时的当前时间作为兼容兜底。
 */
export function createTimeoutAt(
  serverNow: Date | string,
  timeoutSeconds: number,
  getSystemNow: SystemNow = () => Date.now(),
): string {
  const serverNowMs = parseServerInstant(serverNow)

  if (!Number.isFinite(timeoutSeconds)) {
    return ""
  }

  const baseMs = Number.isFinite(serverNowMs) ? serverNowMs : getSystemNow()
  return new Date(baseMs + Math.max(0, timeoutSeconds) * 1000).toISOString()
}

/**
 * 创建基于服务端时间和浏览器单调时钟的倒计时。
 *
 * 后端仍是操作是否超时的最终判定方；此倒计时仅用于前端展示与交互禁用。
 */
export function createServerCountdown(
  payload: ServerTimedPayload,
  monotonicNow: MonotonicNow = () => performance.now(),
  getSystemNow: SystemNow = () => Date.now(),
) {
  const initialRemainingMs = getInitialServerRemainingMs(payload, getSystemNow)
  const receivedAtMonotonicMs = monotonicNow()

  const remainingMs = () => Math.max(
    0,
    initialRemainingMs - (monotonicNow() - receivedAtMonotonicMs),
  )

  return {
    remainingMs,
    remainingSeconds: () => Math.ceil(remainingMs() / 1000),
    isTimeout: () => remainingMs() === 0,
  }
}
