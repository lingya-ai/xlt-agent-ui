"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { useApiRequest } from "../../api/hooks/use-api-request";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../ui/components/alert";
import { Button } from "../../ui/components/button";
import { Skeleton } from "../../ui/components/skeleton";
import { toast } from "../../ui/components/sonner";
import {isSubagentActive, SubagentTaskStatus, type SubagentTask} from "../hooks/use-chat/subagent-schema";
import { useSubagentConversation } from "../hooks/use-chat/use-subagent-conversation";
import { AgentsChatMessage } from "./agents-chat-message";
import { AiChatContextProvider, useAiChatContext } from "./context";
import {
  AiChatContextEventProvider,
  useAiChatContextEventValue,
} from "./events";
import { SubagentTaskStatusBadge } from "./subagent-task-status";
import { useAiChatAccess } from "./use-ai-chat-access";
import { useWorkspaceController } from "./workspace-controller";

interface WorkspaceSubagentDetailProps {
  task: SubagentTask;
}

/** 子任务详情的宿主操作保留根会话权限，消息区域使用独立子会话作用域。 */
export function WorkspaceSubagentDetail({
  task,
}: WorkspaceSubagentDetailProps) {
  const t = useAgentMessages("workspace-subagent-detail");
  const context = useAiChatContext();
  const access = useAiChatAccess();
  const { subagents, readOnly } = useWorkspaceController();
  const cancelRequest = useApiRequest(
    async () => {
      access.requireAccess("execute");
      if (readOnly || !task.cancellable || !access.canRead)
        throw new Error(t.denied.value);
      return context.httpClient.messages.cancelConversationSubagent(task.parentConversationId, task.taskId, {signal: context.signal});
    },
    {
      manual: true,
      disableErrorNotification: true,
      onSuccess: (result) => {
        subagents?.updateTask(result);
        toast.success(
          result.status === SubagentTaskStatus.CANCELLED
            ? t.cancelled.value
            : t.cancelRequested.value,
        );
        void subagents?.refresh();
      },
      onError: () => {
        toast.error(t.cancelError.value);
      },
    },
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b px-3 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 break-words text-sm font-medium">
            {task.description}
          </h3>
          <div className="shrink-0">
            <SubagentTaskStatusBadge task={task} />
          </div>
          {!readOnly && isSubagentActive(task) && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={
                !task.cancellable || !access.canExecute || cancelRequest.loading
              }
              onClick={() => cancelRequest.run()}
            >
              {cancelRequest.loading && (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                />
              )}
              {t.cancel}
            </Button>
          )}
        </div>
        {task.failureMessage && (
          <p className="break-words text-xs text-destructive">
            {task.failureMessage}
          </p>
        )}
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3 p-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        <AiChatContextProvider
          key={task.childConversationId ?? task.taskId}
          value={{
            httpClient: context.httpClient,
            accessPolicies: context.accessPolicies,
            streamTransport: context.streamTransport,
            initialConversationId: task.childConversationId ?? undefined,
          }}
        >
          <SubagentConversation task={task} />
        </AiChatContextProvider>
      </Suspense>
    </div>
  );
}

/** 子任务消息只读展示；独立事件上下文避免污染主聊天的导航和生命周期。 */
function SubagentConversation({ task }: { task: SubagentTask }) {
  const t = useAgentMessages("subagent-conversation");
  const { httpClient, streamTransport } = useAiChatContext();
  const events = useAiChatContextEventValue(
    task.childConversationId ?? undefined,
  );
  const state = useSubagentConversation({
    httpClient,
    task,
    streamTransport,
  });
  return (
    <AiChatContextEventProvider value={events}>
      <div className="flex min-h-0 flex-1 flex-col">
        {state.error ? (
          <div className="p-3">
            <Alert variant="destructive">
              <AlertTitle>{t.loadError}</AlertTitle>
              <AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void state.reload()}
                >
                  {t.retry}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : state.waiting || (!state.loaded && !state.chatList.length) ? (
          <div role="status" className="flex flex-col gap-3 p-3">
            <span className="text-sm text-muted-foreground">{t.waiting}</span>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !state.chatList.length ? (
          <p className="p-3 text-sm text-muted-foreground">
            {t.noConversation}
          </p>
        ) : (
          <AgentsChatMessage
            chatList={state.chatList}
            conversationId={task.childConversationId ?? undefined}
            showMessageNavigator={false}
            messageView={{ defaultMode: "full", switchable: false }}
          />
        )}
      </div>
    </AiChatContextEventProvider>
  );
}
