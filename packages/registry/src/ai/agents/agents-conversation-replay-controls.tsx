"use client";

import { FastForward, Pause, Play, RotateCcw } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { Button } from "../../ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/components/select";
import { cn } from "../../ui/lib/utils";

import {
  REPLAY_SPEED_OPTIONS,
  type ReplaySpeed,
} from "../hooks/use-chat/history-replay";
import type { ConversationReplayStatus } from "../hooks/use-chat/use-conversation-history-replay";
import type { AgentsChatMessageViewMode } from "./message-disclosure-policy";
import { MessageViewSwitcher } from "./message-view-switcher";

export type AgentsConversationReplayControlsProps = {
  className?: string;
  status: ConversationReplayStatus;
  totalSteps: number;
  speed: ReplaySpeed;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onRevealAll: () => void;
  onSpeedChange: (speed: ReplaySpeed) => void;
  messageView?: {
    mode: AgentsChatMessageViewMode;
    onModeChange: (mode: AgentsChatMessageViewMode) => void;
  };
};

/** 会话回放播放控制栏。 */
export function AgentsConversationReplayControls({
  className,
  status,
  totalSteps,
  speed,
  onPlay,
  onPause,
  onRestart,
  onRevealAll,
  onSpeedChange,
  messageView,
}: AgentsConversationReplayControlsProps) {
  const t = useAgentMessages("agents-conversation-replay-controls");
  const isPreparing = status === "preparing";
  const isCompleted = status === "completed";
  const statusLabel =
    status === "playing"
      ? t.playing
      : status === "paused"
        ? t.paused
        : status === "completed"
          ? t.completed
          : t.preparing;

  const handleSpeedChange = (value: string) => {
    const nextSpeed = REPLAY_SPEED_OPTIONS.find(
      (option) => String(option) === value,
    );
    if (nextSpeed !== undefined) onSpeedChange(nextSpeed);
  };

  return (
    <div
      className={cn("border-t bg-background/95 px-3 py-2 sm:px-8", className)}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="text-xs font-medium text-muted-foreground"
            aria-live="polite"
          >
            {statusLabel}
          </span>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {status === "playing" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onPause}
              >
                <Pause className="size-3.5" />
                {t.pause}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPreparing || isCompleted}
                onClick={onPlay}
              >
                <Play className="size-3.5" />
                {t.play}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPreparing || totalSteps === 0}
              onClick={onRestart}
            >
              <RotateCcw className="size-3.5" />
              {t.restart}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPreparing || isCompleted}
              onClick={onRevealAll}
            >
              <FastForward className="size-3.5" />
              {t.revealAll}
            </Button>

            <Select
              value={String(speed)}
              onValueChange={handleSpeedChange}
              disabled={isPreparing}
            >
              <SelectTrigger
                size="sm"
                className="w-[86px]"
                aria-label={t.speed.value}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPLAY_SPEED_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}×
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {messageView && (
              <MessageViewSwitcher
                side="top"
                value={messageView.mode}
                onValueChange={messageView.onModeChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
