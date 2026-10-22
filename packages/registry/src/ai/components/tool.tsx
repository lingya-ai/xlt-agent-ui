"use client";

import {Badge} from "../../ui/components/badge";
import {cn} from "../../ui/lib/utils";
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "../../ui/components/collapsible";
import {ToolAction, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import {
  ArrowRightLeftIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockAlertIcon,
  ClockIcon,
  FilePenLineIcon,
  MinusCircleIcon,
  MousePointerClickIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  ShieldAlertIcon,
  SkipForwardIcon,
  Trash2Icon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import React, {ComponentProps, isValidElement, type ReactNode} from "react";
import {useAgentMessages} from "../../i18n/runtime";
import {CodeBlock} from "./code-block";

/** 安全解析 JSON 字符串，失败时返回 undefined */
function parseJsonSafe(str: string): unknown | undefined {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({className, ...props}: ToolProps) => (
  <Collapsible
    className={cn(
      "group not-prose min-w-0 w-full max-w-full rounded-lg border border-border bg-card",
      className,
    )}
    {...props}
  />
);

export type ToolHeaderProps = {
  title?: string;
  className?: string;
  /** 与 ToolCall.name 对应，如 `tool-${name}` 或 "dynamic-tool" */
  type: `tool-${string}` | "dynamic-tool";
  state: string;
  toolName?: string;
  /** 工具动作类型，用于选择对应图标 */
  action?: string;
  /** 是否可折叠，为 false 时渲染为普通 div（无折叠按钮） */
  collapsible?: boolean;
};

export const getStatusBadge = (status: string, labels: Record<string, string>) => {
  const icons: Record<string, ReactNode> = {
    [ToolCallStatusEnum.Pending]: <CircleIcon className="size-3"/>,
    [ToolCallStatusEnum.Running]: <ClockIcon className="size-3 animate-pulse"/>,
    [ToolCallStatusEnum.AwaitingApproval]: <ClockIcon className="size-3 text-warning"/>,
    [ToolCallStatusEnum.ApprovalResponded]: <CheckCircleIcon className="size-3 text-info"/>,
    [ToolCallStatusEnum.Success]: <CheckCircleIcon className="size-3 text-success"/>,
    [ToolCallStatusEnum.NoResult]: <MinusCircleIcon className="size-3 text-muted-foreground"/>,
    [ToolCallStatusEnum.Error]: <XCircleIcon className="size-3 text-destructive"/>,
    [ToolCallStatusEnum.Timeout]: <ClockAlertIcon className="size-3 text-destructive"/>,
    [ToolCallStatusEnum.ApprovalDenied]: <XCircleIcon className="size-3 text-warning"/>,
    [ToolCallStatusEnum.Blocked]: <ShieldAlertIcon className="size-3 text-warning"/>,
    [ToolCallStatusEnum.Skipped]: <SkipForwardIcon className="size-3 text-muted-foreground"/>,
    [ToolCallStatusEnum.Interrupted]: <PauseIcon className="size-3 text-warning"/>,
  };

  return (
    <Badge className="gap-1 rounded-full text-xs" variant="secondary">
      {icons[status]}
      {labels[status] ?? status}
    </Badge>
  );
};

/** 根据 ToolAction 获取对应图标。 */
export function getToolActionIcon(action: string): ReactNode {
  const iconMap: Record<string, ReactNode> = {
    [ToolAction.DEFAULT]: <WrenchIcon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.SEARCH]: <SearchIcon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.READ]: <BookOpenIcon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.WRITE]: <FilePenLineIcon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.UPDATE]: <FilePenLineIcon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.DELETE]: <Trash2Icon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.EXECUTE]: <PlayIcon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.INTERACT]: <MousePointerClickIcon className="size-3 text-muted-foreground shrink-0"/>,
    [ToolAction.DELEGATE]: <ArrowRightLeftIcon className="size-3 text-muted-foreground shrink-0"/>,
  };
  return iconMap[action] ?? iconMap[ToolAction.DEFAULT];
}

export const ToolHeader = (
  {
    className,
    title,
    type,
    state,
    toolName,
    action = ToolAction.DEFAULT,
    collapsible = true,
    ...props
  }: ToolHeaderProps) => {
  const t = useAgentMessages("tool");
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  const labels: Record<string, string> = {
    [ToolCallStatusEnum.Pending]: t.pending.value,
    [ToolCallStatusEnum.Running]: t.running.value,
    [ToolCallStatusEnum.AwaitingApproval]: t.awaitingApproval.value,
    [ToolCallStatusEnum.ApprovalResponded]: t.approvalResponded.value,
    [ToolCallStatusEnum.Success]: t.success.value,
    [ToolCallStatusEnum.NoResult]: t.noResult.value,
    [ToolCallStatusEnum.Error]: t.error.value,
    [ToolCallStatusEnum.Timeout]: t.timeout.value,
    [ToolCallStatusEnum.ApprovalDenied]: t.approvalDenied.value,
    [ToolCallStatusEnum.Blocked]: t.blocked.value,
    [ToolCallStatusEnum.Skipped]: t.skipped.value,
    [ToolCallStatusEnum.Interrupted]: t.interrupted.value,
  };

  const displayTitle = title ?? derivedName;
  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          {getToolActionIcon(action)}
        </span>
        <span
          className="line-clamp-2 min-w-0 text-left text-xs font-semibold leading-5 text-foreground"
          title={displayTitle}
        >
          {displayTitle}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        {getStatusBadge(state, labels)}
        {collapsible && (
          <ChevronDownIcon
            className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        )}
      </div>
    </>
  );

  const cls = cn(
    "flex w-full items-start justify-between gap-3 border-l-2 border-l-primary bg-card px-3 py-2.5 text-left",
    collapsible &&
      "transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    className,
  );

  if (!collapsible) {
    return (
      <div className={cls} {...props}>
        {inner}
      </div>
    );
  }

  return (
    <CollapsibleTrigger className={cls} {...props}>
      {inner}
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({className, ...props}: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ReactNode | undefined;
};

/**
 * 将字符串内容渲染为合适的展示形式
 * JSON 对象/数组 → CodeBlock；其他文本 → 支持换行的纯文本
 */
function renderStringContent(text: string): React.ReactElement {
  const parsed = parseJsonSafe(text);
  if (parsed !== undefined && typeof parsed === "object" && parsed !== null) {
    return <CodeBlock code={JSON.stringify(parsed, null, 2)} language="json"/>
  }
  const displayText = typeof parsed === "string" ? parsed : text;
  return (
    <div className="min-w-0 overflow-hidden break-words whitespace-pre-wrap p-4 text-sm">
      {displayText}
    </div>
  )
}

export const ToolInput = ({className, input, ...props}: ToolInputProps) => {
  const t = useAgentMessages("tool");

  if (!input) {
    return null;
  }

  let Input = <div>{input as ReactNode}</div>;

  if (typeof input === "object" && !isValidElement(input)) {
    Input = (
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json"/>
    );
  } else if (typeof input === "string") {
    Input = renderStringContent(input);
  }
  return (
    <div className={cn("min-w-0 space-y-2 overflow-hidden p-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {t.parameters}
      </h4>
      <div className="min-w-0 overflow-hidden rounded-md bg-muted/50">
        {Input}
      </div>
    </div>
  )
}

export type ToolOutputProps = ComponentProps<"div"> & {
  output?: ReactNode;
  errorText?: string;
};

export const ToolOutput = ({
                             className,
                             output,
                             errorText,
                             ...props
                           }: ToolOutputProps) => {
  const t = useAgentMessages("tool");

  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json"/>
    );
  } else if (typeof output === "string") {
    Output = renderStringContent(output);
  }

  return (
    <div className={cn("min-w-0 overflow-hidden", !errorText && "space-y-2 p-4", className)} {...props}>
      {!errorText && (
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t.result}
        </h4>
      )}
      <div
        className={cn(
          "min-w-0 overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "max-h-[200px] overflow-y-auto bg-muted text-destructive border border-destructive/30"
            : "overflow-y-hidden bg-muted text-foreground"
        )}
      >
        {errorText && (
          <div className="min-w-0 break-words whitespace-pre-wrap p-2">
            {errorText}
          </div>
        )}
        {Output}
      </div>
    </div>
  );
};
