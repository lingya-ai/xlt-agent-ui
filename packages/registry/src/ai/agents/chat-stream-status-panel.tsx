"use client";

import type {ReactNode} from "react";
import {LoaderCircle, RefreshCw, TriangleAlert, WifiOff} from "lucide-react";
import {useAgentMessages} from "../../i18n/runtime";

import {Alert, AlertDescription, AlertTitle} from "../../ui/components/alert";
import {Badge} from "../../ui/components/badge";
import {Button} from "../../ui/components/button";
import {cn} from "../../ui/lib/utils";

import type {ChatStreamAggregateStatus} from "../hooks/use-chat/chat-stream-status";

interface ChatStreamStatusPanelProps {
  status: ChatStreamAggregateStatus;
  onProbe: () => Promise<void>;
  showTransportSwitch?: boolean;
  onSwitchToWebSocket?: () => void;
  onContinueSse?: () => void;
  className?: string;
}

/** 在聊天输入区统一展示联网、断线恢复与回复显示异常。 */
export function ChatStreamStatusPanel({
  status,
  onProbe,
  showTransportSwitch = false,
  onSwitchToWebSocket,
  onContinueSse,
  className,
}: ChatStreamStatusPanelProps) {
  const content = useAgentMessages("chat-stream-status-panel");

  if (status.kind === "hidden") return null;

  let title: ReactNode = content.suspectedTitle;
  let description: ReactNode = content.suspectedDescription;
  let badge: ReactNode = content.suspectedBadge;
  let badgeVariant: "warning" | "destructive" | "info" = "warning";
  let toneClassName = "border-warning/40 bg-warning-soft";
  let StatusIcon = TriangleAlert;
  let animateIcon = false;

  if (status.kind === "offline") {
    title = content.offlineTitle;
    description = content.offlineDescription;
    badge = content.offlineBadge;
    badgeVariant = "destructive";
    toneClassName = "border-destructive/40 bg-destructive-soft";
    StatusIcon = WifiOff;
  } else if (status.kind === "reconnecting") {
    title = content.reconnectingTitle;
    description = content.reconnectingDescription;
    badge = content.recoveringBadge;
    StatusIcon = RefreshCw;
    animateIcon = true;

    if (status.healthStatus === "buffered") {
      title = content.reconnectingBufferedTitle;
      description = content.reconnectingBufferedDescription;
    } else if (status.healthStatus === "unavailable") {
      title = content.reconnectingUnavailableTitle;
      description = content.reconnectingUnavailableDescription;
      badgeVariant = "destructive";
      toneClassName = "border-destructive/40 bg-destructive-soft";
    }
  } else if (status.kind === "rebuilding") {
    title = content.rebuildingTitle;
    description = status.healthStatus === "buffered"
      ? content.rebuildingBufferedDescription
      : content.rebuildingDescription;
    badge = content.syncingBadge;
    badgeVariant = "info";
    toneClassName = "border-info/40 bg-info-soft";
    StatusIcon = RefreshCw;
    animateIcon = true;
  } else if (status.kind === "checking") {
    title = content.checkingTitle;
    description = content.checkingDescription;
    badge = content.checkingBadge;
    badgeVariant = "info";
    toneClassName = "border-info/40 bg-info-soft";
    StatusIcon = LoaderCircle;
    animateIcon = true;
  } else if (status.healthStatus === "buffered") {
    title = content.bufferedTitle;
    description = showTransportSwitch
      ? content.bufferedSwitchDescription
      : content.bufferedDescription;
    badge = content.bufferedBadge;
  } else if (status.healthStatus === "unavailable") {
    title = content.unavailableTitle;
    description = content.unavailableDescription;
    badge = content.unavailableBadge;
    badgeVariant = "destructive";
    toneClassName = "border-destructive/40 bg-destructive-soft";
  } else if (status.healthStatus === "inconclusive") {
    title = content.inconclusiveTitle;
    description = content.inconclusiveDescription;
    badge = content.inconclusiveBadge;
  }

  const healthNeedsProbe =
    status.healthStatus === "suspected" ||
    status.healthStatus === "buffered" ||
    status.healthStatus === "unavailable" ||
    status.healthStatus === "inconclusive";
  const showProbeAction =
    !showTransportSwitch &&
    status.kind !== "offline" &&
    (status.kind === "checking" || healthNeedsProbe);
  const isChecking = status.kind === "checking" || status.isProbing;

  return (
    <Alert
      role="status"
      aria-live="polite"
      aria-busy={isChecking}
      className={cn(toneClassName, className)}
    >
      <StatusIcon
        className={cn(animateIcon && "animate-spin motion-reduce:animate-none")}
        aria-hidden="true"
      />
      <AlertTitle className="flex min-w-0 flex-wrap items-center gap-2 line-clamp-none">
        <span className="min-w-0 break-words">{title}</span>
        <Badge variant={badgeVariant} className="bg-muted">{badge}</Badge>
      </AlertTitle>
      <AlertDescription className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 break-words">{description}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showTransportSwitch && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={onSwitchToWebSocket}
              >
                {content.switchToWebSocket}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onContinueSse}
              >
                {content.continueSse}
              </Button>
            </>
          )}
          {showProbeAction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isChecking}
              onClick={() => void onProbe()}
            >
              {isChecking ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              {isChecking ? content.checking : content.retry}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
