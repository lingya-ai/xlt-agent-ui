"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { Button } from "../../ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/components/popover";
import { toast } from "../../ui/components/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/components/tooltip";
import { cn } from "../../ui/lib/utils";

import { formatTokenRate } from "../lib/token-usage";

const VIEWBOX_SIZE = 24;
const CIRCLE_CENTER = VIEWBOX_SIZE / 2;
const CIRCLE_RADIUS = 8.5;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const COMPACTION_RECOMMENDATION_THRESHOLD = 0.5;

interface MessageContextUsageRingProps {
  /** 当前消息上下文占模型上下文窗口的比例。 */
  ratio?: number | null;
  /** 当前对话是否正在生成。生成过程中不允许压缩。 */
  isResponding?: boolean;
  /** 刷新当前会话的上下文用量。 */
  onRefresh?: () => Promise<void>;
  /** 执行上下文压缩。 */
  onCompact?: () => Promise<void>;
  className?: string;
}

/** 展示当前消息上下文窗口占用比例，并提供手动压缩入口。 */
export function MessageContextUsageRing({
  ratio,
  isResponding = false,
  onRefresh,
  onCompact,
  className,
}: MessageContextUsageRingProps) {
  const t = useAgentMessages("message-context-usage-ring");
  const [open, setOpen] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);

  if (ratio == null || !Number.isFinite(ratio)) {
    return null;
  }

  const normalizedRatio = Math.min(Math.max(ratio, 0), 1);
  const percentage = formatTokenRate(normalizedRatio) ?? "0%";
  const label = t.usageLabel({ percentage }).value;
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - normalizedRatio);
  const isCompressionRecommended =
    normalizedRatio >= COMPACTION_RECOMMENDATION_THRESHOLD;
  const isTriggerDisabled = !onRefresh && !onCompact;

  const handleRefresh = async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // 请求错误已由 HTTP 客户端标准化；保留提示层，允许用户重新尝试。
      toast.error(t.refreshFailed);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCompact = async () => {
    if (!onCompact || isResponding) return;

    setIsCompacting(true);
    try {
      await onCompact();
      toast.success(t.compactSucceeded);
      setOpen(false);
    } catch {
      // 请求错误已由 HTTP 客户端标准化；保留提示层，允许用户重新尝试。
      toast.error(t.compactFailed);
    } finally {
      setIsCompacting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={!open && isTooltipOpen} onOpenChange={setIsTooltipOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              aria-label={label}
              className={cn(
                "relative size-6 shrink-0 rounded-full outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isTriggerDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                className,
              )}
              disabled={isTriggerDisabled}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="absolute inset-0 size-full"
                viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
              >
                <circle
                  className="text-border"
                  cx={CIRCLE_CENTER}
                  cy={CIRCLE_CENTER}
                  fill="none"
                  r={CIRCLE_RADIUS}
                  strokeWidth={3}
                  style={{ stroke: "currentColor" }}
                />
                <circle
                  className="text-primary transition-[stroke-dashoffset] duration-300"
                  cx={CIRCLE_CENTER}
                  cy={CIRCLE_CENTER}
                  fill="none"
                  r={CIRCLE_RADIUS}
                  strokeDasharray={`${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  strokeWidth={3}
                  style={{ stroke: "currentColor" }}
                  transform={`rotate(-90 ${CIRCLE_CENTER} ${CIRCLE_CENTER})`}
                />
              </svg>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80" side="top" sideOffset={8}>
        <p className="text-sm leading-6 text-muted-foreground">
          {isCompressionRecommended
            ? t.compactDescription({ percentage })
            : t.lowUsageDescription({ percentage })}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Button
            disabled={isRefreshing || isCompacting || !onRefresh}
            type="button"
            variant="outline"
            onClick={() => void handleRefresh()}
          >
            {isRefreshing && <Loader2Icon className="size-4 animate-spin" />}
            {t.refreshContext}
          </Button>
          <Button
            disabled={isRefreshing || isCompacting || isResponding || !onCompact}
            type="button"
            onClick={() => void handleCompact()}
          >
            {isCompacting && <Loader2Icon className="size-4 animate-spin" />}
            {t.compactNow}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
