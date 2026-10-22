"use client";

import { Fragment, type ReactNode } from "react";
import { useAgentMessages } from "../../i18n/runtime";
import { formatDuration } from "../lib/time";
import { tokenCountToK } from "../lib/token";
import { formatTokenRate, getCacheHitRate, type TokenUsage } from "../lib/token-usage";
import type { ChatItem } from "../hooks/use-chat/types";
import { isTerminalMessageStatus } from "../hooks/use-chat/conversation-message-status";
import { TokenUsageDetails } from "./token-usage-details";

interface TurnExecutionStatsProps {
  item: ChatItem;
  endDuration?: number;
  usage?: TokenUsage | null;
}

/** 仅显示可靠的后端统计，缺失数据不使用前端观测值补齐。 */
export function TurnExecutionStats({
  item,
  endDuration,
  usage,
}: TurnExecutionStatsProps) {
  const t = useAgentMessages("turn-execution-stats");
  const settled =
    !item.loading &&
    !item.messageStatsPending &&
    item.status !== undefined &&
    isTerminalMessageStatus(item.status);
  const duration =
    endDuration ?? (settled ? item.executionTimeMillis : undefined);
  const calls = settled ? item.totalToolCalls : undefined;
  const steps = settled ? item.processingSteps : undefined;
  const metrics: { key: string; content: ReactNode }[] = [];
  if (duration !== undefined) {
    metrics.push({ key: "duration", content: <span className="font-mono">{formatDuration(duration)}</span> });
  }
  if (steps !== undefined || calls !== undefined) {
    metrics.push({
      key: "round-steps",
      content: (
        <span className="whitespace-nowrap">
          {t.roundSteps({ rounds: steps ?? "—", steps: calls ?? "—" })}
        </span>
      ),
    });
  }
  if (usage !== undefined) {
    metrics.push(
      {
        key: "token-usage",
        content: (
          <TokenUsageDetails
            usage={usage}
            variant="compact"
            compactLabel={usage == null ? undefined : `${tokenCountToK(usage.totalTokens).toFixed(1)}k`}
            showIcon={false}
          />
        ),
      },
      {
        key: "cache-hit",
        content: (
          <span className="whitespace-nowrap">
            {t.cacheHit({ rate: usage == null ? "—" : formatTokenRate(getCacheHitRate(usage)) ?? "—" })}
          </span>
        ),
      },
    );
  }
  if (metrics.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {metrics.map((metric, index) => (
        <Fragment key={metric.key}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {metric.content}
        </Fragment>
      ))}
    </div>
  );
}
