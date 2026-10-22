"use client";

import {useState} from "react";
import {ChevronUpIcon, Clock3Icon} from "lucide-react";
import {useAgentMessages} from "../../i18n/runtime";

import {Collapsible, CollapsibleContent, CollapsibleTrigger} from "../../ui/components/collapsible";
import {ScrollArea} from "../../ui/components/scroll-area";
import {Tooltip, TooltipContent, TooltipTrigger} from "../../ui/components/tooltip";
import {cn} from "../../ui/lib/utils";

import type {AgentAsyncTask} from "../hooks/use-chat/use-agent-async-tasks";

interface AgentsChatAsyncTasksProps {
  tasks: readonly AgentAsyncTask[];
}

/** 输入框贴片中的异步任务列表，由父级提供筛选后的任务及共享边框。 */
export function AgentsChatAsyncTasks({tasks}: AgentsChatAsyncTasksProps) {
  const t = useAgentMessages("agents-chat-async-tasks");
  const [open, setOpen] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 w-full">
      <CollapsibleTrigger
        type="button"
        className="group flex h-7 w-full items-center gap-2 px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Clock3Icon className="size-3.5 shrink-0" aria-hidden="true"/>
        <span className="min-w-0 flex-1 font-medium">{t.title({count: tasks.length})}</span>
        <ChevronUpIcon
          className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea style={{height: Math.min(tasks.length, 2) * 28}} overflowXHidden>
          <ul className="m-0 list-none p-0">
            {tasks.map(task => (
              <li key={task.taskId} className="h-7 min-w-0 px-2 text-xs">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex h-full w-full min-w-0 items-center gap-2 rounded-sm px-1 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 truncate text-foreground">{task.title}</span>
                      <span aria-hidden="true" className="shrink-0 text-muted-foreground">·</span>
                      <span
                        className={cn("shrink-0 text-muted-foreground", task.status === "FAILED" && "text-destructive")}
                        role="status"
                      >
                        {(Object.prototype.hasOwnProperty.call(t.taskStatuses, task.status) ? t.taskStatuses[task.status as keyof typeof t.taskStatuses] : task.status)}
                        {task.progressPercent != null && <span className="ml-1.5 tabular-nums">{task.progressPercent}%</span>}
                      </span>
                      {task.trackingStatus === "SUSPENDED" && <span className="shrink-0 text-warning">{t.trackingPaused}</span>}
                      {task.notificationStatus === "FAILED" && <span className="shrink-0 text-destructive">{t.notificationFailed}</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs break-words">
                    <div className="flex flex-col gap-1">
                      <span>{task.title}</span>
                      <span>{t.notificationStatusLabel}: {(Object.prototype.hasOwnProperty.call(t.notificationStatuses, task.notificationStatus) ? t.notificationStatuses[task.notificationStatus as keyof typeof t.notificationStatuses] : task.notificationStatus)}</span>
                      {task.trackingStatus === "SUSPENDED" && <span>{t.trackingSuspended}</span>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
