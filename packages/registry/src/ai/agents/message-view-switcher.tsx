"use client";

import { ChevronDown, List, ListFilter } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { Button } from "../../ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../../ui/components/dropdown-menu";
import { cn } from "../../ui/lib/utils";

import type { AgentsChatMessageViewMode } from "./message-disclosure-policy";

export type MessageViewSwitcherProps = {
  value: AgentsChatMessageViewMode;
  onValueChange: (value: AgentsChatMessageViewMode) => void;
  className?: string;
  iconOnly?: boolean;
  side?: "top" | "right" | "bottom" | "left";
};

export type MessageViewToggleProps = {
  value: AgentsChatMessageViewMode;
  onValueChange: (value: AgentsChatMessageViewMode) => void;
  className?: string;
};

/** 单击切换视图，并通过无障碍名称说明将要切换到的模式。 */
export function MessageViewToggle({
  value,
  onValueChange,
  className,
}: MessageViewToggleProps) {
  const t = useAgentMessages("message-view-switcher");
  const targetMode = value === "compact" ? "full" : "compact";
  const targetDescription =
    targetMode === "compact"
      ? t.compactViewDescription.value
      : t.fullViewDescription.value;
  const TargetIcon = targetMode === "compact" ? ListFilter : List;

  return (
    <Button
      type="button"
      aria-label={targetDescription}
      className={cn(
        "relative z-20 ml-1 shrink-0 rounded p-0.5 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onValueChange(targetMode);
      }}
      size="icon-sm"
      title={targetDescription}
      variant="ghost"
    >
      <TargetIcon className="size-3.5" />
    </Button>
  );
}

/**
 * 使用紧凑菜单在重点内容与完整过程之间切换当前会话的展示方式。
 */
export function MessageViewSwitcher({
  value,
  onValueChange,
  className,
  iconOnly = false,
  side = "bottom",
}: MessageViewSwitcherProps) {
  const t = useAgentMessages("message-view-switcher");
  const currentLabel = value === "compact" ? t.compactView : t.fullView;
  const currentDescription =
    value === "compact"
      ? t.compactViewDescription.value
      : t.fullViewDescription.value;
  const CurrentIcon = value === "compact" ? ListFilter : List;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          aria-label={currentDescription}
          className={cn(
            "shrink-0 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground",
            iconOnly && "bg-transparent",
            className,
          )}
          size={iconOnly ? "icon-sm" : "sm"}
          title={currentDescription}
          variant="ghost"
        >
          <CurrentIcon className="size-3.5" />
          {!iconOnly && (
            <>
              <span>{currentLabel}</span>
              <ChevronDown className="size-3 opacity-60" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 max-w-[calc(100vw-2rem)]"
        collisionPadding={8}
        side={side}
      >
        <DropdownMenuLabel>{t.viewLabel}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => {
            if (nextValue === "compact" || nextValue === "full") {
              onValueChange(nextValue);
            }
          }}
        >
          <DropdownMenuRadioItem
            className="items-start py-2.5"
            value="compact"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-foreground">
                {t.compactView}
              </span>
              <span className="text-xs leading-4 text-muted-foreground">
                {t.compactViewDescription}
              </span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="items-start py-2.5" value="full">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-foreground">{t.fullView}</span>
              <span className="text-xs leading-4 text-muted-foreground">
                {t.fullViewDescription}
              </span>
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
