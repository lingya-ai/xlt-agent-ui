export const MS_PER_SECOND = 1000
export const MS_PER_MINUTE = 60000
export const MS_PER_HOUR = 60 * MS_PER_MINUTE
export const MS_PER_DAY = 24 * MS_PER_HOUR

/**
 * 格式化进行中任务的已执行时长。
 *
 * @param startedAt - 任务开始时间戳（毫秒）
 * @param now - 当前时间戳（毫秒）
 * @returns 格式化后的执行时长
 */
export function formatWorkingDuration(startedAt: number, now: number): string {
  return formatDuration(now - startedAt)
}

/**
 * 格式化任务执行时长。
 *
 * 不足一秒时保留毫秒单位；达到一秒后，前导和末尾值为 0 的时间单位不会展示，
 * 非零时间单位之间的 0 会保留，
 * 以准确表达中间缺失的时间单位。
 *
 * @param millis - 执行时长（毫秒）
 * @returns 例如：`328ms`、`1d 1h 1m 1s`、`1d 0h 1m`、`5s`
 */
export function formatDuration(millis: number): string {
  const normalizedMillis = Math.max(0, Math.floor(millis))

  if (normalizedMillis < MS_PER_SECOND) {
    return `${normalizedMillis}ms`
  }

  let remaining = Math.floor(normalizedMillis / MS_PER_SECOND)
  const days = Math.floor(remaining / (MS_PER_DAY / MS_PER_SECOND))
  remaining %= MS_PER_DAY / MS_PER_SECOND
  const hours = Math.floor(remaining / (MS_PER_HOUR / MS_PER_SECOND))
  remaining %= MS_PER_HOUR / MS_PER_SECOND
  const minutes = Math.floor(remaining / (MS_PER_MINUTE / MS_PER_SECOND))
  const seconds = remaining % (MS_PER_MINUTE / MS_PER_SECOND)
  const parts = [
    {value: days, label: `${days}d`},
    {value: hours, label: `${hours}h`},
    {value: minutes, label: `${minutes}m`},
    {value: seconds, label: `${seconds}s`},
  ]
  const firstNonZeroIndex = parts.findIndex(part => part.value !== 0)
  const lastNonZeroIndex = parts.reduce((lastIndex, part, index) => (part.value === 0 ? lastIndex : index), -1)

  return parts
    .slice(firstNonZeroIndex, lastNonZeroIndex + 1)
    .map(part => part.label)
    .join(" ")
}
