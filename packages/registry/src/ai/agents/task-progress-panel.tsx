/**
 * 任务进度面板
 *
 * 由后端 task-write 整表替换成功后推送的 extension.category === "taskProgress"
 * 触发渲染。面板粘连在 Agent 对话输入框上方，会话级展示当前任务快照：
 *  - 顶部：标题 + 进度条 + 完成计数 + 折叠箭头
 *  - 折叠区：任务列表（按状态聚合排序）
 *
 * 数据约定：每次 taskProgress 事件携带的是当前轮次的完整任务快照，前端取最新一次覆盖整个
 * 面板状态；任务计划属于当前轮次，模型开启新一轮后需要重新提交计划。
 *
 * @author 思追(shaco)
 */
"use client"

import React, {useMemo, useState} from "react"
import {CheckCircle2, ChevronUpIcon, Circle, Loader2} from "lucide-react"
import {Badge} from "../../ui/components/badge"
import {cn} from "../../ui/lib/utils"
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "../../ui/components/collapsible"
import {Progress} from "../../ui/components/progress"
import {useAgentMessages} from "../../i18n/runtime"
import {TASK_STATUS, type TaskProgressContent, type TaskSummary} from "../hooks/use-chat/schema"

export type TaskProgressPanelProps = {
  /** 任务进度扩展内容（最新一次快照） */
  progress: TaskProgressContent
  /** 是否默认展开任务列表，默认 false */
  defaultOpen?: boolean
  /** 附加类名 */
  className?: string
  /** 嵌入贴片时由父容器提供背景和边框。 */
  variant?: "standalone" | "embedded"
}

/** 状态排序权重：in_progress > pending > completed */
const statusOrder: Record<string, number> = {
  [TASK_STATUS.IN_PROGRESS]: 0,
  [TASK_STATUS.PENDING]: 1,
  [TASK_STATUS.COMPLETED]: 2,
}

/** 任务状态徽标 */
function TaskStatusIcon({status}: { status: string }) {
  const t = useAgentMessages("task-progress-panel")
  switch (status) {
    case TASK_STATUS.IN_PROGRESS:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-info">
          <Loader2 className="size-3 animate-spin"/>
          <span>{t.inProgressLabel}</span>
        </span>
      )
    case TASK_STATUS.COMPLETED:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="size-3"/>
          <span>{t.completedLabel}</span>
        </span>
      )
    case TASK_STATUS.PENDING:
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Circle className="size-3"/>
          <span>{t.pendingLabel}</span>
        </span>
      )
  }
}

/** 单个任务行 */
function TaskRow({
  task,
}: {
  task: TaskSummary
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
        "-mx-2 border-l-2 border-transparent"
      )}
    >
      <TaskStatusIcon status={task.status}/>
      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
        #{task.id}
      </Badge>
      <span className="min-w-0 flex-1 truncate">
        {task.content}
      </span>
    </div>
  )
}

/**
 * 任务进度面板组件
 */
export function TaskProgressPanel(
  {
    progress,
    defaultOpen = false,
    className,
    variant = "standalone",
  }: TaskProgressPanelProps) {
  const t = useAgentMessages("task-progress-panel")
  const [open, setOpen] = useState(defaultOpen)

  // 排序：in_progress > pending > completed，同类按 id 升序
  const sortedTasks = useMemo(() => {
    return [...progress.tasks].sort((a, b) => {
      const orderDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
      if (orderDiff !== 0) return orderDiff
      return a.id.localeCompare(b.id)
    })
  }, [progress.tasks])

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "w-full",
        variant === "standalone" && [
          "rounded-lg border bg-background/95 shadow-sm",
          "backdrop-blur supports-backdrop-filter:bg-background/80",
        ],
        className
      )}
    >
      {/* 顶部概览行：标题 + 进度条 + 计数 + 折叠按钮 */}
      <CollapsibleTrigger
        className="group flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-sm font-medium text-foreground shrink-0">{t.title}</span>
        <Progress
          value={progress.progressPercent}
          className="h-1.5 flex-1 min-w-[60px]"
        />
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {t.completedCount({count: progress.completed, total: progress.total})}
        </span>
        <ChevronUpIcon
          className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0"
        />
      </CollapsibleTrigger>

      {/* 任务列表 */}
      <CollapsibleContent className="border-t border-border/60">
        <div className="px-3 py-2 space-y-0.5 max-h-[100px] overflow-auto">
          {sortedTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
