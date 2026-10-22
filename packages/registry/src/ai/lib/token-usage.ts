import type {Usage as TokenUsage} from "@lingya-ai/agents-sdk/browser";
export type {Usage as TokenUsage,InputTokenBreakdown} from "@lingya-ai/agents-sdk/browser";
/** 将服务端提供的比例格式化为百分比，未提供时不显示。 */
export function formatTokenRate(rate:number|null|undefined):string|null {
 return rate==null?null:new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:1}).format(rate);
}

/** 缓存命中率缺省时，使用服务端实际观测到的输入分项计算。 */
export function getCacheHitRate(usage: TokenUsage): number | null {
  if (usage.cacheHitRate != null && Number.isFinite(usage.cacheHitRate) && usage.cacheHitRate >= 0 && usage.cacheHitRate <= 1) {
    return usage.cacheHitRate;
  }
  const breakdown = usage.inputTokenBreakdown;
  if (!breakdown) return null;
  const {observedInputTokens, cachedInputTokens} = breakdown;
  if (!Number.isFinite(observedInputTokens) || observedInputTokens <= 0 ||
      !Number.isFinite(cachedInputTokens) || cachedInputTokens < 0 || cachedInputTokens > observedInputTokens) return null;
  return cachedInputTokens / observedInputTokens;
}
