"use client";

import { useRef, type ReactNode } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockAlertIcon,
  ClockIcon,
  LoaderCircleIcon,
  MinusCircleIcon,
  PauseIcon,
  ShieldAlertIcon,
  SkipForwardIcon,
  XCircleIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/components/collapsible";
import { cn } from "../../ui/lib/utils";
import { getToolActionIcon } from "../components/tool";
import {ToolCallStatusEnum} from "../hooks/use-chat/schema";

interface ToolActivityRowProps {
  title: string;
  action: string;
  statusLabel: string;
  state: string;
  failed: boolean;
  open?: boolean;
  defaultOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

/** 普通工具仅显示活动行；真实结果按需挂载，开合覆盖仍由消息列表保存。 */
export function ToolActivityRow({
  title,
  action,
  statusLabel,
  state,
  failed,
  open,
  defaultOpen,
  onOpenChange,
  children,
}: ToolActivityRowProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useControllableState({
    prop: open,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const rowClassName = cn(
    "flex min-h-6 min-w-0 w-full max-w-full items-center gap-2 py-0.5 text-left text-[14px] leading-5",
    failed ? "text-destructive" : "text-muted-foreground",
  );
  const statusIcons: Record<string, ReactNode> = {
    [ToolCallStatusEnum.Pending]: <ClockIcon />,
    [ToolCallStatusEnum.Running]: (
      <LoaderCircleIcon className="motion-safe:animate-spin" />
    ),
    [ToolCallStatusEnum.AwaitingApproval]: <ClockIcon />,
    [ToolCallStatusEnum.ApprovalResponded]: <CheckIcon />,
    [ToolCallStatusEnum.Success]: <CheckIcon />,
    [ToolCallStatusEnum.NoResult]: <MinusCircleIcon />,
    [ToolCallStatusEnum.Error]: <XCircleIcon />,
    [ToolCallStatusEnum.Timeout]: <ClockAlertIcon />,
    [ToolCallStatusEnum.ApprovalDenied]: <XCircleIcon />,
    [ToolCallStatusEnum.Blocked]: <ShieldAlertIcon />,
    [ToolCallStatusEnum.Skipped]: <SkipForwardIcon />,
    [ToolCallStatusEnum.Interrupted]: <PauseIcon />,
  };
  const content = (
    <>
      <span
        aria-hidden="true"
        className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5 [&_svg]:text-current"
      >
        {getToolActionIcon(action)}
      </span>
      <span className="min-w-0 truncate" title={title}>
        {title}
      </span>
      {children && (
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 motion-safe:transition-transform",
            expanded && "rotate-180",
          )}
        />
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] leading-4 [&_svg]:size-3">
        <span aria-hidden="true">{statusIcons[state]}</span>
        {statusLabel}
      </span>
    </>
  );
  if (!children)
    return (
      <div className={rowClassName} data-tool-state={state}>
        {content}
      </div>
    );

  const handleOpenChange = (next: boolean) => {
    if (!next) trigger.current?.focus();
    setExpanded(next);
  };
  return (
    <Collapsible
      open={expanded}
      onOpenChange={handleOpenChange}
      className="not-prose min-w-0 w-full"
      data-tool-state={state}
    >
      <CollapsibleTrigger
        ref={trigger}
        className={cn(
          rowClassName,
          "w-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !failed && "hover:text-foreground",
        )}
      >
        {content}
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 pt-1 pl-[22px]">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
