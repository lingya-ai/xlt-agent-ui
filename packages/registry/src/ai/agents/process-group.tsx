"use client";

import { useRef, type ReactNode } from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/components/collapsible";
import { cn } from "../../ui/lib/utils";
import { getToolActionIcon } from "../components/tool";
import { ToolAction } from "../hooks/use-chat/schema";
import {
  ProcessActivityStatus,
  ProcessActivityKind,
  type ProcessActivitySummary,
} from "./process-activity-summary";
import { useLiveProcessActivity } from "./use-live-process-activity";

interface ProcessGroupProps {
  summary: ProcessActivitySummary;
  isActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 组内没有可渲染成员时只显示摘要行，不提供展开入口。 */
  expandable?: boolean;
  children: ReactNode;
}

/** 纯前端汇总和展开入口；重点工具与待处理工具由父级独立渲染。 */
export function ProcessGroup({
  summary,
  isActive,
  open,
  onOpenChange,
  expandable = true,
  children,
}: ProcessGroupProps) {
  const t = useAgentMessages("process-group");
  const trigger = useRef<HTMLButtonElement>(null);
  const labels: Record<string, string> = {
    [ToolAction.SEARCH]: t.search.value,
    [ToolAction.READ]: t.read.value,
    [ToolAction.WRITE]: t.write.value,
    [ToolAction.UPDATE]: t.update.value,
    [ToolAction.DELETE]: t.delete.value,
    [ToolAction.EXECUTE]: t.execute.value,
    [ToolAction.INTERACT]: t.interact.value,
    [ToolAction.DELEGATE]: t.delegate.value,
    [ToolAction.DEFAULT]: t.default.value,
  };
  const runningLabels: Record<string, string> = {
    [ToolAction.SEARCH]: t.runningSearch.value,
    [ToolAction.READ]: t.runningRead.value,
    [ToolAction.WRITE]: t.runningWrite.value,
    [ToolAction.UPDATE]: t.runningUpdate.value,
    [ToolAction.DELETE]: t.runningDelete.value,
    [ToolAction.EXECUTE]: t.runningExecute.value,
    [ToolAction.INTERACT]: t.runningInteract.value,
    [ToolAction.DELEGATE]: t.runningDelegate.value,
    [ToolAction.DEFAULT]: t.runningDefault.value,
  };
  const preparingLabels: Record<string, string> = {
    [ToolAction.SEARCH]: t.preparingSearch.value,
    [ToolAction.READ]: t.preparingRead.value,
    [ToolAction.WRITE]: t.preparingWrite.value,
    [ToolAction.UPDATE]: t.preparingUpdate.value,
    [ToolAction.DELETE]: t.preparingDelete.value,
    [ToolAction.EXECUTE]: t.preparingExecute.value,
    [ToolAction.INTERACT]: t.preparingInteract.value,
    [ToolAction.DELEGATE]: t.preparingDelegate.value,
    [ToolAction.DEFAULT]: t.preparingDefault.value,
  };
  const live = useLiveProcessActivity(
    summary.activity ?? { kind: ProcessActivityKind.Idle },
    isActive && summary.status !== ProcessActivityStatus.Attention,
    summary.latestActivity,
  );
  const completedLabels: Record<string, string> = {
    [ToolAction.SEARCH]: t.doneSearch.value,
    [ToolAction.READ]: t.doneRead.value,
    [ToolAction.WRITE]: t.doneWrite.value,
    [ToolAction.UPDATE]: t.doneUpdate.value,
    [ToolAction.DELETE]: t.doneDelete.value,
    [ToolAction.EXECUTE]: t.doneExecute.value,
    [ToolAction.INTERACT]: t.doneInteract.value,
    [ToolAction.DELEGATE]: t.doneDelegate.value,
    [ToolAction.DEFAULT]: t.doneDefault.value,
  };
  // 仅完成摘要按次数排名；复制排序保持原投影和运行阶段的类别顺序不变。
  const rankedCategories = [...summary.categories].sort(
    (left, right) => right.count - left.count,
  );
  const completed = rankedCategories
    .slice(0, 3)
    .map(({ action }) => completedLabels[action]);
  const continuation = (label: string) =>
    label.charAt(0).toLowerCase() + label.slice(1);
  let completedTitle = completed[0] ?? t.doneThinking.value;
  if (completed.length === 2) {
    const second = completed[1]!;
    const prefix = t.doneSharedPrefix.value;
    const shared =
      prefix !== "" &&
      completedTitle.startsWith(prefix) &&
      second.startsWith(prefix);
    completedTitle = t.doneJoinTwo({
      first: completedTitle,
      second: continuation(shared ? second.slice(prefix.length) : second),
    }).value;
  } else if (completed.length === 3) {
    completedTitle = [
      completedTitle,
      ...completed.slice(1).map((label) => continuation(label ?? "")),
    ].join(t.doneSeparator.value);
    if (rankedCategories.length > 3)
      completedTitle = t.doneMore({ title: completedTitle }).value;
  }
  const activity =
    summary.categories.length > 0
      ? summary.categories
          .slice(0, 3)
          .map((category) => labels[category.action])
          .join(t.separator.value) +
        (summary.categories.length > 3 ? t.more.value : "")
      : t.thinking.value;
  const isThinking =
    isActive &&
    (live.kind === ProcessActivityKind.Reasoning ||
      live.kind === ProcessActivityKind.Text);
  const title =
    summary.status === ProcessActivityStatus.Attention
      ? t.attention({ activity }).value
      : isThinking
        ? t.thinkingRunning.value
        : isActive && live.kind === ProcessActivityKind.Tool
          ? (live.preparing ? preparingLabels : runningLabels)[
              live.action ?? ToolAction.DEFAULT
            ]
          : completedTitle;
  const preview = isActive ? live.detail : undefined;
  const handleOpenChange = (next: boolean) => {
    if (!next) trigger.current?.focus();
    onOpenChange(next);
  };
  const headerIcon =
    !isThinking && summary.categories.length > 0 ? (
      getToolActionIcon(
        (isActive ? live.action : undefined) ??
          (isActive ? summary.categories : rankedCategories)[0]?.action ??
          ToolAction.DEFAULT,
      )
    ) : (
      <BrainIcon className="size-3.5 shrink-0" />
    );
  const headerText = (
    <span
      className="min-w-0 truncate"
      title={preview ? `${title} ${preview}` : title}
    >
      {title}
      {preview && <> · {preview}</>}
    </span>
  );
  // 没有可渲染成员时只保留摘要行；避免展开后没有任何内容的无效入口。
  if (!expandable)
    return (
      <div className="flex min-h-6 min-w-0 max-w-full items-center gap-2 py-0.5 text-[14px] leading-5 text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-current">
        {headerIcon}
        {headerText}
      </div>
    );
  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="flex min-w-0 flex-col gap-1"
    >
      <CollapsibleTrigger
        ref={trigger}
        aria-label={open ? t.collapse.value : t.expand.value}
        className="flex min-h-6 min-w-0 max-w-full items-center gap-2 rounded-sm py-0.5 text-left text-[14px] leading-5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:text-current"
      >
        {headerIcon}
        {headerText}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 motion-safe:transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0">
        {/* 保留短分组的自然高度，长分组在内部滚动，避免撑满消息列表。 */}
        <div
          role="region"
          aria-label={title}
          tabIndex={0}
          className="max-h-[min(20rem,50vh)] overflow-y-auto rounded-sm pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="flex min-w-0 flex-col gap-1">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
