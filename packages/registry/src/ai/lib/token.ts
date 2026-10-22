/** 十进制 token 单位常量。 */
export const TOKENS_PER_K = 1_000
export const TOKENS_PER_M = 1_000_000
export const TOKENS_PER_G = 1_000_000_000

/**
 * 格式化 Token 数量。
 *
 * Token 用量通常会出现在空间有限的消息指标与列表列中；统一使用英文紧凑单位，
 * 保证聊天消息、会话列表等入口对同一数值展示一致。
 *
 * @param tokenCount - 需要展示的 Token 数量
 * @returns 最多保留一位小数的紧凑格式，例如 `1.2K`
 */
export function formatCompactToken(tokenCount: number): string {
  return compactTokenFormatter.format(tokenCount)
}

/** 将存储的 token 数量转换为模型配置输入框使用的十进制 K 数值。 */
export function tokenCountToK(tokenCount: number): number {
  return tokenCount / TOKENS_PER_K
}

/**
 * 将模型配置输入框中的十进制 K 数值转换为整数 token 数量。
 *
 * 非有限值和负数表示无效输入，调用方应保留当前值。
 */
export function parseTokenKInput(value: string): number | undefined {
  if (value.trim() === "") return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.round(parsed * TOKENS_PER_K)
}

const compactTokenFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})
