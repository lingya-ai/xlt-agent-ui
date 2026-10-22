import type {ReactElement, ReactNode} from 'react'

import {useAgentMessages} from '../../i18n/runtime'
import {CoinsIcon} from 'lucide-react'

import {Tooltip, TooltipContent, TooltipTrigger} from '../../ui/components/tooltip'
import {cn} from '../../ui/lib/utils'

import {formatCompactToken} from '../lib/token'
import {formatTokenRate, getCacheHitRate, type TokenUsage} from '../lib/token-usage'

export type TokenUsageDetailsProps = {
  /** 已归一化的平台 Token 用量。 */
  usage: TokenUsage | null
  /** 紧凑模式仅展示总量并通过 Tooltip 呈现分项。 */
  variant?: 'compact' | 'detail'
  /** 嵌套在可点击父元素中时使用 span，避免产生嵌套按钮。 */
  compactTrigger?: 'button' | 'span'
  /** 仅覆盖紧凑触发器的文本，详情面板继续使用统一格式。 */
  compactLabel?: ReactNode
  /** 紧凑触发器是否显示 Token 图标，默认显示。 */
  showIcon?: boolean
  className?: string
}

type TokenUsageMetricProps = {
  label: ReactNode
  value: ReactNode
}

function TokenUsageMetric({label, value}: TokenUsageMetricProps): ReactElement {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs opacity-70">{label}</p>
      <p className="mt-1 font-mono text-xs font-medium tabular-nums">{value}</p>
    </div>
  )
}

function TokenUsageBreakdown({usage}: {usage: TokenUsage | null}): ReactElement {
  const t = useAgentMessages('token-usage-details')

  if (usage == null) {
    return <span className="text-xs text-muted-foreground">{t.unavailable}</span>
  }

  const breakdown = usage.inputTokenBreakdown
  const cacheHitRate = formatTokenRate(getCacheHitRate(usage))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-x-4 gap-y-3">
        <TokenUsageMetric label={t.inputTokens} value={formatCompactToken(usage.inputTokens)} />
        <TokenUsageMetric
          label={t.reasoningTokens}
          value={usage.reasoningTokens == null ? t.unavailable : formatCompactToken(usage.reasoningTokens)}
        />
        <TokenUsageMetric label={t.outputTokens} value={formatCompactToken(usage.outputTokens)} />
        <TokenUsageMetric label={t.totalTokens} value={formatCompactToken(usage.totalTokens)} />
      </div>
      <div className="grid grid-cols-4 gap-x-4 gap-y-3">
        <TokenUsageMetric
          label={t.uncachedInputTokens}
          value={breakdown == null ? t.unavailable : formatCompactToken(breakdown.uncachedInputTokens)}
        />
        <TokenUsageMetric
          label={t.cachedInputTokens}
          value={breakdown == null ? t.unavailable : formatCompactToken(breakdown.cachedInputTokens)}
        />
        <TokenUsageMetric
          label={t.cacheCreationInputTokens}
          value={
            breakdown?.cacheCreationInputTokens == null
              ? t.unavailable
              : formatCompactToken(breakdown.cacheCreationInputTokens)
          }
        />
        <TokenUsageMetric label={t.cacheHitRate} value={cacheHitRate ?? t.unavailable} />
      </div>
    </div>
  )
}

/**
 * 统一展示平台 Token 用量，使用短横线表达空值，并保留与明确零值的语义差异。
 */
export function TokenUsageDetails({
  usage,
  variant = 'detail',
  compactTrigger = 'button',
  compactLabel,
  showIcon = true,
  className,
}: TokenUsageDetailsProps): ReactElement {
  const t = useAgentMessages('token-usage-details')

  if (variant === 'detail') {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-3 text-card-foreground', className)}>
        <TokenUsageBreakdown usage={usage} />
      </div>
    )
  }

  if (usage == null) {
    return <span className={cn('text-xs text-muted-foreground', className)}>{t.unavailable}</span>
  }

  const triggerClassName = cn(
    'inline-flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground',
    className,
  )
  const triggerContent = (
    <>
      {showIcon && <CoinsIcon className="size-3" />}
      {compactLabel ?? formatCompactToken(usage.totalTokens)}
    </>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {compactTrigger === 'span' ? (
          <span aria-label={t.compactAriaLabel.value} className={triggerClassName}>
            {triggerContent}
          </span>
        ) : (
          <button
            type="button"
            aria-label={t.compactAriaLabel.value}
            onClick={(event) => event.stopPropagation()}
            className={triggerClassName}
          >
            {triggerContent}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent
        className="w-[34rem] max-w-[calc(100vw-2rem)] border border-border bg-popover p-3 text-popover-foreground shadow-sm [&_svg]:bg-popover [&_svg]:fill-popover"
        side="top"
      >
        <TokenUsageBreakdown usage={usage} />
      </TooltipContent>
    </Tooltip>
  )
}
