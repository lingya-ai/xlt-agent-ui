"use client";

import React, { forwardRef, useEffect, useImperativeHandle } from "react";
import { CircleAlert, MessageSquare } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { Button } from "../../ui/components/button";

import { ConversationEmptyState } from "../components/conversation";
import { Loader } from "../components/loader";
import {
  findLatestTaskProgress,
  type ReplaySpeed,
} from "../hooks/use-chat/history-replay";
import type { AgentsConfig } from "../hooks/use-chat/use-agents-config";
import { useConversationHistoryReplay } from "../hooks/use-chat/use-conversation-history-replay";
import { useConversationReplaySource } from "../hooks/use-chat/use-conversation-replay-source";
import { AgentsChatMessage } from "./agents-chat-message";
import { useMessageViewController } from "./message-view-controller";
import type { AgentsChatMessageViewOptions } from "./message-disclosure-policy";
import {
  AgentsChatWorkspaceLayout,
  type AgentsChatWorkspaceOptions,
} from "./agents-chat-workspace-layout";
import { AgentsConversationReplayControls } from "./agents-conversation-replay-controls";
import { AiChatConfigContextProvider } from "./config";
import { useAiChatContext } from "./context";
import {
  AiChatContextEventProvider,
  useAiChatContextEventValue,
} from "./events";
import { TaskProgressPanel } from "./task-progress-panel";
import {
  WorkspaceControllerProvider,
  useWorkspaceController,
} from "./workspace-controller";

export type AgentsConversationReplayProps = {
  conversationId: string;
  className?: string;
  emptyState?: {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
  };
  workspace?: AgentsChatWorkspaceOptions;
  autoPlay?: boolean;
  defaultSpeed?: ReplaySpeed;
  /** 回放消息展示策略，默认使用重点模式并允许用户切换到全部视图。 */
  messageView?: AgentsChatMessageViewOptions;
};

export type AgentsConversationReplayInstance = {
  /** 打开当前会话的只读工作区。 */
  openWorkspace: () => void;
};

type ReplayInstanceControllerProps = {
  replayRef: React.ForwardedRef<AgentsConversationReplayInstance>;
};

function ReplayInstanceController({
  replayRef,
}: ReplayInstanceControllerProps) {
  const { openWorkspace } = useWorkspaceController();

  useImperativeHandle(replayRef, () => ({ openWorkspace }), [openWorkspace]);
  return null;
}

const replayConfig = {
  modelConfig: {
    defaultModel: null,
    modelKeyGroups: [],
  },
  supportAttachmentExt: [],
  maxAttachmentCount: 0,
} satisfies AgentsConfig;
const replayConfigContextValue = { config: replayConfig };

/**
 * 分享会话专用的只读回放组件。
 *
 * 组件先固定完整历史快照，再按消息和事件顺序逐步投影 UI；不复用 AgentsChat 的实时会话状态机。
 */
export const AgentsConversationReplay = forwardRef<
  AgentsConversationReplayInstance,
  AgentsConversationReplayProps
>(
  (
    {
      conversationId,
      className,
      emptyState,
      workspace,
      autoPlay = true,
      defaultSpeed = 1,
      messageView,
    },
    ref,
  ) => {
    const t = useAgentMessages("agents-conversation-replay");
    const { httpClient, onConversationIdChange } = useAiChatContext();
    const { source, loading, loadProgress, error, reload } =
      useConversationReplaySource({
        httpClient,
        conversationId,
      });
    const replay = useConversationHistoryReplay({
      source,
      autoPlay,
      defaultSpeed,
    });
    const eventValue = useAiChatContextEventValue(conversationId);

    // 回放没有实时聊天状态机，需要主动同步固定会话 ID，供制品预览和下载读取。
    useEffect(() => {
      onConversationIdChange?.(conversationId);
    }, [conversationId, onConversationIdChange]);

    const latestTaskProgress = findLatestTaskProgress(replay.visibleChatList);
    const {
      mode: messageViewMode,
      canSwitch: canSwitchMessageView,
      changeMode: handleMessageViewModeChange,
      scrollRootRef: messageViewRootRef,
    } = useMessageViewController(messageView, true);
    const loadProgressText =
      loadProgress.totalMessages === undefined
        ? undefined
        : loadProgress.phase === "messages"
          ? t.loadingMessages({
              loaded: loadProgress.loadedMessages,
              total: loadProgress.totalMessages,
            })
          : t.loadingEvents({
              loaded: loadProgress.loadedMessages,
              total: loadProgress.totalMessages,
            });

    return (
      <AiChatConfigContextProvider value={replayConfigContextValue}>
        <AiChatContextEventProvider value={eventValue}>
          <WorkspaceControllerProvider enabled={replay.status === "completed"}>
            <AgentsChatWorkspaceLayout
              workspace={workspace}
              className={className}
            >
              <ReplayInstanceController replayRef={ref} />

              <div
                ref={messageViewRootRef}
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                {loading ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <Loader size={20} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t.loadingHistory}</p>
                      {loadProgressText && (
                        <p
                          className="text-xs text-muted-foreground"
                          aria-live="polite"
                        >
                          {loadProgressText}
                        </p>
                      )}
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                    <CircleAlert className="size-10 text-destructive" />
                    <div className="max-w-md space-y-1">
                      <p className="text-sm font-medium">{t.loadFailed}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.loadFailedDescription}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={reload}>
                      {t.retry}
                    </Button>
                  </div>
                ) : source?.messages.length === 0 ? (
                  <ConversationEmptyState
                    className="flex-1"
                    icon={
                      emptyState?.icon ?? <MessageSquare className="size-12" />
                    }
                    title={emptyState?.title ?? t.emptyTitle.value}
                    description={
                      emptyState?.description ?? t.emptyDescription.value
                    }
                  />
                ) : (
                  <>
                    <AgentsChatMessage
                      className="min-h-0 flex-1"
                      chatList={replay.visibleChatList}
                      conversationId={conversationId}
                      messageView={{ mode: messageViewMode }}
                      contentClassName="px-3 pb-6 pt-2 sm:px-8"
                      showMessageNavigator
                      showWorkingIndicator={false}
                    />

                    <div className="shrink-0 bg-background px-3 sm:px-8">
                      <div className="mx-auto w-full max-w-3xl">
                        {latestTaskProgress && (
                          <TaskProgressPanel
                            progress={latestTaskProgress}
                            className="mb-2"
                          />
                        )}
                      </div>
                    </div>

                    <AgentsConversationReplayControls
                      status={replay.status}
                      totalSteps={replay.totalSteps}
                      speed={replay.speed}
                      onPlay={replay.play}
                      onPause={replay.pause}
                      onRestart={replay.restart}
                      onRevealAll={replay.revealAll}
                      onSpeedChange={replay.setSpeed}
                      messageView={
                        canSwitchMessageView
                          ? {
                              mode: messageViewMode,
                              onModeChange: handleMessageViewModeChange,
                            }
                          : undefined
                      }
                    />
                  </>
                )}
              </div>
            </AgentsChatWorkspaceLayout>
          </WorkspaceControllerProvider>
        </AiChatContextEventProvider>
      </AiChatConfigContextProvider>
    );
  },
);

AgentsConversationReplay.displayName = "AgentsConversationReplay";
