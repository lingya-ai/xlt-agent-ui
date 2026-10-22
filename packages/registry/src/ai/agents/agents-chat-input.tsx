"use client";
import { AgentGoalBar } from "./agent-goal-bar";
import {
  AgentGoalPhase,
  type AgentGoalConfig,
} from "../hooks/use-chat/agent-goal-schema";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";

import { useAiChatAccess } from "./use-ai-chat-access";
import { PermissionExplanation } from "../../integration/access";

/**
 * 知识库/对话场景下的聊天输入组件
 *
 * 提供：多行文本输入、附件上传、语音输入、模型选择、深度思考开关，
 * 并统一通过 onSubmit 提交消息。
 */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BrainIcon,
  ClipboardListIcon,
  PlusIcon,
  FolderOpenIcon,
  ListIcon,
  ListFilterIcon,
  Loader2Icon,
  Minimize2Icon,
  XIcon,
  TargetIcon,
  PaperclipIcon,
  SquareIcon,
  SquarePenIcon,
} from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import {
  Attachment,
  AttachmentHoverCard,
  AttachmentHoverCardContent,
  AttachmentHoverCardTrigger,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  getMediaCategory,
} from "../components/attachments";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputHandle,
  PromptInputHeader,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "../components/prompt-input";
import { SpeechInput } from "../components/speech-input";
import { ChatStatusEnum, type FileUIPart } from "../components/types";
import {
  type ChatItem,
  type SendCallback,
  type UserChatQuery,
} from "../hooks/use-chat/types";
import type { TaskProgressContent } from "../hooks/use-chat/schema";
import type { AgentAsyncTask } from "../hooks/use-chat/use-agent-async-tasks";
import {
  getDefaultModelSelectionKey,
  type AttachmentExt,
} from "../hooks/use-chat/use-agents-config";
import { useUploadChatAttachment } from "../hooks/use-chat/use-upload-chat-attachment";
import { formatTokenRate } from "../lib/token-usage";
import { usePromptInputFooterLayout } from "./use-prompt-input-footer-layout";
import { InputSuggestionMenu } from "./input-suggestion-menu";
import {
  InputMenuSource,
  useInputSuggestionMenu,
} from "./use-input-suggestion-menu";
import type {
  AgentsChatInputSuggestionGroup,
  AgentsChatInputSuggestions,
} from "./input-suggestion-types";
export type {
  AgentsChatInputSuggestionItem,
  AgentsChatInputSuggestionGroup,
  AgentsChatInputSuggestions,
} from "./input-suggestion-types";
import { AgentModelSelector, type SelectedModel } from "./agent-model-selector";
import { AgentsChatAsyncTasks } from "./agents-chat-async-tasks";
import { AgentsChatSubagents } from "./agents-chat-subagents";
import { useOptionalWorkspaceController } from "./workspace-controller";
import { AgentsChatQueue } from "./agents-chat-queue";
import { getContextCompactionCommandState } from "./context-compaction-command";
import type { AgentsChatMessageViewMode } from "./message-disclosure-policy";
import { MessageContextUsageRing } from "./message-context-usage-ring";
import { Button } from "../../ui/components/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/components/alert-dialog";
import { Separator } from "../../ui/components/separator";
import { cn } from "../../ui/lib/utils";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/components/popover";
import { toast } from "../../ui/components/sonner";
import { useAiChatContext } from "./context";
import { useAiChatConfigContext } from "./config";
import { useAiChatContextEvent } from "./events";
import { TaskProgressPanel } from "./task-progress-panel";
import { ChatInputMode, useChatInputMode } from "./use-chat-input-mode";
import { prepareChatAttachmentFiles } from "./chat-attachment-file-name";

/** 聊天配置：当前选中的模型与是否开启深度思考 */
export type AgentsChatConfig = {
  /** 选中的模型信息，未选时为 undefined */
  model?: SelectedModel | undefined;
  /** 是否开启深度思考（仅对支持 thinkingMode 的模型生效） */
  thinking: boolean;
  /** 随本条用户消息提交的模式。 */
  planMode?: boolean;
  /** 随本条用户消息创建目标。 */
  goalMode?: boolean;
};

export type AgentsChatInputSubmit = (
  query: UserChatQuery,
  config: AgentsChatConfig,
  callbacks?: SendCallback,
) => Promise<void>;

export type { InputSuggestionTrigger } from "./input-syntax";

/** 聊天输入组件的 Props */
export type AgentsChatInputProps = {
  /** 目标控制面由共享聊天统一管理。 */
  goalController?: AgentGoalController;
  /** 后端声明的目标能力及预算限制。 */
  goalConfig?: AgentGoalConfig;
  /** 服务端已经生效的模式，用于初始化和空草稿同步。 */
  serverPlanMode?: boolean;
  /** 最近会话模型的思考模式，由 SDK ConversationConfig 提供 */
  initialThinking?: boolean;
  /** 服务端确认当前消息仍在等待计划审批。 */
  awaitingPlanApproval?: boolean;
  /** 提交消息的回调 */
  onSubmit: AgentsChatInputSubmit;
  /** 当前是否仍有消息在后端处理；恢复订阅断开时也用于保持停止按钮 */
  isResponding?: boolean;
  /** 输入框占位文案 */
  placeholder?: string;
  /** 依赖配置尚未完整时仅阻止提交，保留能力配置入口。 */
  submissionBlocked?: boolean;
  /** 输入框能力语法建议配置 */
  inputSuggestions?: AgentsChatInputSuggestions;
  /** 是否在输入框内、发送按钮旁显示上下文窗口用量，默认不显示。 */
  showContextWindowUsage?: boolean;
  /** 是否在统一菜单中显示通用上下文压缩命令，默认显示。 */
  showContextCompactionCommand?: boolean;
  /** 停止生成时的回调 */
  onStop?: () => void;
  /** 清空当前会话并开启新对话 */
  onRestart?: () => void;
  /** 是否启用语音输入 */
  enableSpeech?: boolean;
  /** 支持的附件上传格式 */
  attachments?: Array<AttachmentExt>;
  /** 当前消息上下文占模型上下文窗口的比例。 */
  messageContextUsageRatio?: number | null;
  /** 当前是否正在读取上下文窗口用量。 */
  contextUsageLoading?: boolean;
  /** 主动刷新当前会话的上下文用量。 */
  onRefreshContext?: () => Promise<void>;
  /** 立即压缩当前会话上下文。 */
  onCompactContext?: () => Promise<void>;
  /** 输入框内展示的消息视图切换配置。 */
  messageView?: {
    mode: AgentsChatMessageViewMode;
    onModeChange: (mode: AgentsChatMessageViewMode) => void;
  };
  /** 渲染在文本输入框上方的业务状态摘要。 */
  renderHeader?: (options: { disabled: boolean }) => React.ReactNode;
  /** 当前会话中仍在等待执行的消息。 */
  queuedMessages?: readonly ChatItem[];
  /** 当前会话的完整异步任务列表，仅在展示时过滤已结束任务。 */
  asyncTasks?: readonly AgentAsyncTask[];
  /** 用于在切换会话时重置异步任务贴片的展开状态。 */
  conversationId?: string;
  /** 取消一条仍在等待执行的消息。 */
  onCancelQueuedMessage?: (messageId: string) => Promise<void>;
  /** 当前会话的最新任务进度快照。 */
  taskProgress?: TaskProgressContent;
  /** 是否显示模型选择器，默认显示。 */
  showModelSelector?: boolean;
  /** 是否显示深度思考开关，默认显示。 */
  showThinkingToggle?: boolean;
  /** 是否显示菜单内的新对话入口，默认显示。 */
  showRestart?: boolean;
  /** 是否显示附件入口，默认显示。 */
  showAttachments?: boolean;
  /** 是否显示工作区入口，默认显示。 */
  showWorkspace?: boolean;
  /** 自定义工作区入口文案。 */
  workspaceLabel?: string;
};

/** 单个附件的上传结果 */
export type UploadResult = {
  status: "uploading" | "success" | "error" | "removed";
  fileId?: number;
};

/**
 * 聊天输入主组件：整合输入框、附件、语音、模型选择
 */
export const AgentsChatInput = ({
  submissionBlocked = false,
  onSubmit,
  initialThinking = false,
  serverPlanMode,
  awaitingPlanApproval = false,
  goalController,
  goalConfig,
  isResponding = false,
  placeholder,
  inputSuggestions,
  showContextWindowUsage = false,
  showContextCompactionCommand = true,
  onStop,
  onRestart,
  enableSpeech = true,
  attachments,
  messageContextUsageRatio,
  contextUsageLoading = false,
  onRefreshContext,
  onCompactContext,
  messageView,
  renderHeader,
  queuedMessages = [],
  asyncTasks = [],
  conversationId,
  onCancelQueuedMessage,
  taskProgress,
  showModelSelector = true,
  showThinkingToggle = true,
  showRestart = true,
  showAttachments = true,
  showWorkspace = true,
  workspaceLabel,
}: AgentsChatInputProps) => {
  const t = useAgentMessages("agents-chat-input");
  const { httpClient } = useAiChatContext();
  const access = useAiChatAccess();
  const { config } = useAiChatConfigContext();
  const { chatInputTextInsertEvent } = useAiChatContextEvent();
  const workspaceController = useOptionalWorkspaceController();
  const subagents = workspaceController?.subagents;
  const handleOpenSubagents = () => {
    workspaceController?.showSubagents();
    void subagents?.refresh();
    workspaceController?.openWorkspace();
  };
  const uploadFileAttachment = useUploadChatAttachment(httpClient, () =>
    access.requireAccess("attachmentWrite"),
  );
  // 当前选中模型信息（通过 AgentModelSelector 的 onModelChange 回调更新）
  const [selectedModel, setSelectedModel] = useState<
    SelectedModel | undefined
  >();
  const defaultModelSelectionKey = getDefaultModelSelectionKey(
    config.modelConfig.defaultModel,
  );
  const defaultThinking = initialThinking;
  // 是否开启深度思考
  const [thinking, setThinking] = useState<boolean>(defaultThinking);
  // 输入框文本内容
  const [text, setText] = useState<string>("");
  const goalAvailable = Boolean(
    goalController && goalConfig?.supported && access.canExecute,
  );
  const [cursor, setCursor] = useState({ start: 0, end: 0 });
  const [requestedContextRefreshKey, setRequestedContextRefreshKey] = useState<
    string | null
  >(null);
  const [compactConfirmOpen, setCompactConfirmOpen] = useState(false);
  const [isCompactingContext, setIsCompactingContext] = useState(false);
  // 对话状态：ready | submitted | streaming | error
  const [status, setStatus] = useState<ChatStatusEnum>(ChatStatusEnum.READY);

  useEffect(() => {
    setThinking(defaultThinking);
  }, [defaultModelSelectionKey, defaultThinking]);

  // 切换到不支持思考模式的模型时，自动重置 thinking 开关，避免遗留状态
  useEffect(() => {
    if (selectedModel && !selectedModel.thinkingMode) {
      setThinking(false);
    }
  }, [selectedModel]);

  // 附件上传状态：attachmentId → UploadResult
  const uploadResultsRef = useRef<Map<string, UploadResult>>(new Map());
  const activeUploadsRef = useRef<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<Map<string, UploadResult>>(
    new Map(),
  );

  const { mode, planMode, goalMode, selectMode, markSubmitted } =
    useChatInputMode(
      conversationId,
      serverPlanMode,
      Boolean(text.trim()) || uploadResults.size > 0,
    );

  // PromptInput 的命令式句柄，用于在 onConversationStart 中清空附件
  const promptInputRef = useRef<PromptInputHandle>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const compactingContextRef = useRef(false);
  const { footerRef, toolsRef, showToolLabels } = usePromptInputFooterLayout();
  const isGenerating = status === ChatStatusEnum.SUBMITTED;
  const capabilityControlsDisabled = isGenerating || !access.canWrite;
  // 底部工具区的默认入口是否可见：决定模式按钮前是否需要分隔符分割。
  const hasDefaultToolActions =
    (showAttachments && Boolean(attachments?.length)) ||
    Boolean(showWorkspace && workspaceController) ||
    Boolean(showThinkingToggle && selectedModel?.thinkingMode);

  const handleOpenWorkspace = () => {
    if (!workspaceController) return;
    if (!workspaceController.listLoaded && !workspaceController.listLoading) {
      void workspaceController.refreshFiles();
    }
    workspaceController?.openWorkspace();
  };

  const hasContextUsage =
    messageContextUsageRatio != null &&
    Number.isFinite(messageContextUsageRatio);
  const contextUsagePercentage = hasContextUsage
    ? (formatTokenRate(Math.min(Math.max(messageContextUsageRatio, 0), 1)) ??
      "0%")
    : null;
  const contextUsagePending = !hasContextUsage && contextUsageLoading;
  const contextCommandState = getContextCompactionCommandState({
    conversationId,
    isResponding,
    usagePending: contextUsagePending,
    canCompact: Boolean(onCompactContext) && access.canExecute,
  });
  const contextCommandStatus =
    contextCommandState.status === "NO_CONTEXT"
      ? t.noContext
      : contextCommandState.status === "RESPONDING"
        ? t.waitForGeneration
        : contextCommandState.status === "LOADING"
          ? t.contextUsageLoading
          : (contextUsagePercentage ?? t.contextUnavailable);
  const contextSuggestionGroups: AgentsChatInputSuggestionGroup[] =
    showContextCompactionCommand
      ? [
          {
            id: "context-actions",
            label: t.contextGroup,
            triggers: ["/"],
            items: [
              {
                id: "compact-context",
                label: t.compactContext,
                searchText: `${t.compactContext.value} compact context`,
                disabled: contextCommandState.disabled,
                icon: <Minimize2Icon aria-hidden="true" />,
                trailing: contextCommandStatus,
                focusInputAfterSelect: false,
                onSelect: () => setCompactConfirmOpen(true),
              },
            ],
          },
        ]
      : [];
  const suggestionGroups: AgentsChatInputSuggestionGroup[] = [
    ...(showRestart && onRestart
      ? [
          {
            id: "conversation-actions",
            label: t.conversationGroup,
            triggers: ["/" as const],
            items: [
              {
                id: "new-conversation",
                label: t.newConversation,
                searchText: `${t.newConversation.value} new conversation restart`,
                icon: <SquarePenIcon aria-hidden="true" />,
                disabled: !access.canSubmit,
                focusInputAfterSelect: false,
                onSelect: () => {
                  access.requireAccess("submit");
                  onRestart();
                },
              },
            ],
          },
        ]
      : []),
    ...(inputSuggestions?.groups ?? []).map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        disabled: item.disabled || capabilityControlsDisabled,
      })),
    })),
    {
      id: "message-mode",
      label: t.modeForNextMessage,
      triggers: ["/"],
      items: [
        {
          id: "mode-plan",
          label: t.planMode,
          searchText: `${t.planMode.value} plan mode`,
          icon: <ClipboardListIcon aria-hidden="true" />,
          selected: mode === ChatInputMode.PLAN,
          disabled: !access.canWrite,
          onSelect: () =>
            selectMode(
              mode === ChatInputMode.PLAN
                ? ChatInputMode.NORMAL
                : ChatInputMode.PLAN,
            ),
        },
        {
          id: "mode-goal",
          label: t.goalMode,
          searchText: `${t.goalMode.value} goal mode`,
          icon: <TargetIcon aria-hidden="true" />,
          selected: mode === ChatInputMode.GOAL,
          disabled: !access.canWrite || !goalAvailable,
          onSelect: () =>
            selectMode(
              mode === ChatInputMode.GOAL
                ? ChatInputMode.NORMAL
                : ChatInputMode.GOAL,
            ),
        },
      ],
    },
    ...contextSuggestionGroups,
    ...(messageView
      ? [
          {
            id: "message-view",
            label: t.viewGroup,
            triggers: ["/" as const],
            items: [
              {
                id: "view-compact",
                label: t.compactView,
                searchText: `${t.compactView.value} compact view`,
                icon: <ListFilterIcon aria-hidden="true" />,
                selected: messageView.mode === "compact",
                onSelect: () => messageView.onModeChange("compact"),
              },
              {
                id: "view-full",
                label: t.fullView,
                searchText: `${t.fullView.value} full view`,
                icon: <ListIcon aria-hidden="true" />,
                selected: messageView.mode === "full",
                onSelect: () => messageView.onModeChange("full"),
              },
            ],
          },
        ]
      : []),
  ];
  const menu = useInputSuggestionMenu({
    groups: suggestionGroups,
    text,
    onTextChange: setText,
    cursor,
    onCursorChange: setCursor,
    textareaRef,
    conversationId,
  });
  const contextRefreshKey =
    menu.open && menu.trigger === "/" && conversationId
      ? `${conversationId}:${menu.source}:${menu.activeSyntax?.start ?? 0}`
      : null;

  useEffect(() => {
    if (!showContextCompactionCommand || !menu.open || menu.trigger !== "/") {
      setRequestedContextRefreshKey(null);
      return;
    }

    if (
      !contextRefreshKey ||
      !conversationId ||
      isResponding ||
      !onRefreshContext ||
      requestedContextRefreshKey === contextRefreshKey
    ) {
      return;
    }

    setRequestedContextRefreshKey(contextRefreshKey);
    void onRefreshContext().catch(() => {
      // 斜杠菜单保留缓存值或不可用状态，用户仍可继续执行压缩。
    });
  }, [
    menu.trigger,
    conversationId,
    contextRefreshKey,
    isResponding,
    onRefreshContext,
    requestedContextRefreshKey,
    showContextCompactionCommand,
    menu.open,
  ]);

  useEffect(() => {
    setCompactConfirmOpen(false);
  }, [conversationId]);

  chatInputTextInsertEvent.useSubscription(({ text: insertedText }) => {
    setText((currentText) =>
      currentText ? `${currentText}\n\n${insertedText}` : insertedText,
    );

    requestAnimationFrame(() => {
      const textarea = inputContainerRef.current?.querySelector("textarea");
      if (!textarea) return;

      textarea.focus();
      const cursorPosition = textarea.value.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
      setCursor({ start: cursorPosition, end: cursorPosition });
    });
  });

  /**
   * 附件上传状态变更回调（由 AttachmentUploadTracker 调用）
   */
  const handleUploadStateChange = useCallback(
    (id: string, result: UploadResult) => {
      if (result.status === "removed") {
        uploadResultsRef.current.delete(id);
        activeUploadsRef.current.delete(id);
      } else {
        uploadResultsRef.current.set(id, result);
        if (result.status === "uploading") {
          activeUploadsRef.current.add(id);
        } else {
          activeUploadsRef.current.delete(id);
        }
      }
      setIsUploading(activeUploadsRef.current.size > 0);
      setUploadResults(new Map(uploadResultsRef.current));
    },
    [],
  );

  const updateCursor = useCallback((textarea: HTMLTextAreaElement) => {
    setCursor({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }, []);

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.currentTarget.value);
      updateCursor(event.currentTarget);
    },
    [updateCursor],
  );

  const handleTextSelection = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      updateCursor(event.currentTarget);
    },
    [updateCursor],
  );

  const handleCompactConfirmOpenChange = (nextOpen: boolean) => {
    if (isCompactingContext) return;
    setCompactConfirmOpen(nextOpen);
    if (!nextOpen) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleCompactContext = async () => {
    access.requireAccess("execute");
    if (!onCompactContext || compactingContextRef.current) return;

    compactingContextRef.current = true;
    setIsCompactingContext(true);
    try {
      await onCompactContext();
      toast.success(t.compactContextSucceeded);
      setCompactConfirmOpen(false);
    } catch {
      // 保留确认弹窗与当前会话，允许用户原地重试。
      toast.error(t.compactContextFailed);
    } finally {
      compactingContextRef.current = false;
      setIsCompactingContext(false);
    }
  };

  // 语音转写结果追加到输入框（有已有内容时用空格拼接）
  const handleTranscriptionChange = useCallback((transcript: string) => {
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }, []);

  // 防重复提交标记（ref 同步读取，避免 React 批量更新期间多次触发）
  const submittingRef = useRef(false);

  // 提交消息：query 必须包含非空白文本，更新状态并调用 onSubmit，清空输入
  const handleSubmit = async (
    message: PromptInputMessage,
  ): Promise<void | false> => {
    access.requireAccess("submit");
    if (submissionBlocked) return false;
    if (submittingRef.current || awaitingPlanApproval) return;
    if ((message.files?.length ?? 0) > config.maxAttachmentCount) {
      toast.warning(
        t.attachmentCountLimit({ count: config.maxAttachmentCount }).value,
      );
      return;
    }

    const query = message.text.trim();
    const hasAttachments = Boolean(message.files?.length);

    if (!query) return;

    // 确保无附件正在上传
    if (activeUploadsRef.current.size > 0) return;

    submittingRef.current = true;
    setStatus(ChatStatusEnum.SUBMITTED);

    // 构建附件数据：仅包含上传成功的文件
    let files: { id: number }[] | undefined;
    if (hasAttachments) {
      files = Array.from(uploadResultsRef.current.values())
        .filter((r) => r.status === "success" && r.fileId != null)
        .map((r) => ({ id: r.fileId! }));
    }

    // 存在失败附件时阻止提交，提示用户移除后重试
    const hasFailedAttachments = Array.from(
      uploadResultsRef.current.values(),
    ).some((r) => r.status === "error");
    if (hasFailedAttachments) {
      submittingRef.current = false;
      setStatus(ChatStatusEnum.READY);
      toast.error(t.fileUploadError);
      return;
    }

    try {
      await onSubmit(
        {
          query,
          files,
        },
        {
          model: selectedModel,
          thinking,
          planMode,
          goalMode: goalMode && goalAvailable,
        },
        {
          onConversationStart: () => {
            setStatus(ChatStatusEnum.STREAMING);
          },
          onConversationComplete: (hasError) => {
            setStatus(hasError ? ChatStatusEnum.ERROR : ChatStatusEnum.READY);
          },
        },
      );

      markSubmitted();
      // POST 被后端接纳即清空本次快照；排队和流式执行继续由 useChat 在后台管理。
      setText("");
      setCursor({ start: 0, end: 0 });
      uploadResultsRef.current.clear();
      activeUploadsRef.current.clear();
      setUploadResults(new Map());
      promptInputRef.current?.clear();
      setStatus(ChatStatusEnum.READY);
    } catch (error) {
      setStatus(ChatStatusEnum.READY);
      throw error;
    } finally {
      submittingRef.current = false;
    }
  };

  // 提交状态只覆盖当前 POST；Agent 执行期间仍保留正常发送能力。
  const effectiveStatus = status;
  const hasDraftContent = Boolean(text.trim()) || uploadResults.size > 0;
  const hasQuery = Boolean(text.trim());
  const shouldShowStop = isResponding && !hasDraftContent && Boolean(onStop);
  const isSubmitDisabled = useMemo(
    () =>
      submissionBlocked ||
      !access.canSubmit ||
      isGenerating ||
      !hasQuery ||
      isUploading,
    [submissionBlocked, access.canSubmit, isGenerating, hasQuery, isUploading],
  );

  // 附件类型限制：将 AttachmentExt[] 转为 HTML accept 属性格式（MIME 类型列表）
  const accept = useMemo(
    () => attachments?.map((a) => a.media).join(",") || undefined,
    [attachments],
  );

  const handlePrepareAttachmentFiles: NonNullable<
    React.ComponentProps<typeof PromptInput>["prepareFiles"]
  > = (files, source) => {
    if (!access.canUpload) return [];
    const prepared = prepareChatAttachmentFiles(files, source);
    for (const file of prepared.rejected) {
      toast.warning(t.attachmentFileNameTooLong, {
        description: summarizeAttachmentName(file.name),
      });
    }
    for (const file of prepared.renamed) {
      toast.warning(t.pastedImageFileNameShortened, {
        description: summarizeAttachmentName(file.newName),
      });
    }
    return prepared.files;
  };

  // 拖拽、粘贴或文件选择包含不支持的文件时，明确提示用户而不是静默忽略
  const handleAttachmentError = ({
    code,
    message,
  }: {
    code: string;
    message: string;
  }) => {
    toast.warning(
      code === "max_files"
        ? t.attachmentCountLimit({ count: config.maxAttachmentCount }).value
        : message,
    );
  };

  const hasQueuedMessages = queuedMessages.length > 0;
  const hasAsyncTasks = asyncTasks.length > 0;
  const hasSubagents = (subagents?.activeCount ?? 0) > 0;
  const hasGoalBar = Boolean(
    goalAvailable &&
      goalController?.goal &&
      goalController.goal.phase !== AgentGoalPhase.Complete,
  );
  const hasStatusPanel =
    hasQueuedMessages ||
    hasAsyncTasks ||
    hasSubagents ||
    Boolean(taskProgress) ||
    hasGoalBar ||
    Boolean(goalController?.error);

  return (
    <div ref={inputContainerRef} className="min-w-0 w-full">
      <div
        hidden={!hasStatusPanel}
        className="mx-2 rounded-t-lg border border-b-0 border-input bg-background pb-2"
      >
        <AgentsChatAsyncTasks
          key={`async-tasks:${conversationId ?? "new"}`}
          tasks={asyncTasks}
        />
        {hasAsyncTasks && hasSubagents && <Separator />}
        {hasSubagents && subagents && (
          <AgentsChatSubagents state={subagents} onOpen={handleOpenSubagents} />
        )}
        {(hasAsyncTasks || hasSubagents) && taskProgress && <Separator />}
        {taskProgress && (
          <TaskProgressPanel progress={taskProgress} variant="embedded" />
        )}
        {(hasAsyncTasks || hasSubagents || taskProgress) && hasGoalBar && (
          <Separator />
        )}
        {goalAvailable && goalController && goalConfig && (
          <AgentGoalBar
            key={`goal:${conversationId ?? "new"}`}
            controller={goalController}
          />
        )}
        {goalController?.error && (
          <div className="flex items-center gap-2 p-3 text-sm">
            <span>{t.goalLoadFailed}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void goalController.refresh().catch(() => {
                  /* 读取失败保留目标错误区域。 */
                });
              }}
            >
              {t.goalRetry}
            </Button>
          </div>
        )}
        {(hasGoalBar || hasAsyncTasks || hasSubagents || taskProgress) &&
          hasQueuedMessages && <Separator />}
        <AgentsChatQueue
          messages={queuedMessages}
          canCancel={access.canExecute}
          onCancel={onCancelQueuedMessage}
          variant="embedded"
        />
      </div>
      {awaitingPlanApproval && isResponding && onStop && (
        <div className="flex justify-end py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!access.canExecute}
            onClick={onStop}
          >
            <SquareIcon aria-hidden="true" />
            {t.stopGeneration}
          </Button>
        </div>
      )}
      <div hidden={awaitingPlanApproval}>
        <Popover modal={false} open={menu.open && !awaitingPlanApproval}>
          <PopoverAnchor asChild>
            <div className="min-w-0">
              <PromptInput
                ref={promptInputRef}
                className={cn(
                  hasStatusPanel && "relative -mt-2 rounded-md bg-background",
                )}
                globalDrop
                multiple
                accept={accept}
                maxFiles={config.maxAttachmentCount}
                prepareFiles={handlePrepareAttachmentFiles}
                onError={handleAttachmentError}
                onSubmit={handleSubmit}
              >
                {/* 附件上传追踪器：监听文件选择，立即触发上传 */}
                <AttachmentUploadTracker
                  uploadFileAttachment={uploadFileAttachment}
                  onStateChange={handleUploadStateChange}
                />
                {/*
                 * 附件组件内部使用动态 Intlayer 字典。首次挂载若发生挂起，必须限制在输入框头部，
                 * 避免向上冒泡到 Next.js 路由 loading 边界，导致整个对话区域闪屏。
                 */}
                <Suspense fallback={null}>
                  <PromptInputAttachmentsDisplay
                    uploadResults={uploadResults}
                  />
                </Suspense>
                {renderHeader?.({ disabled: isGenerating || !access.canWrite })}
                <PromptInputBody>
                  <PromptInputTextarea
                    maxHeight={200}
                    placeholder={placeholder}
                    ref={textareaRef}
                    onChange={handleTextChange}
                    onClick={handleTextSelection}
                    onKeyDown={menu.handleKeyDown}
                    onKeyUp={handleTextSelection}
                    onSelect={handleTextSelection}
                    value={text}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={
                      menu.open && menu.source === InputMenuSource.Syntax
                    }
                    aria-controls={menu.open ? menu.listId : undefined}
                    aria-activedescendant={
                      menu.open &&
                      menu.source === InputMenuSource.Syntax &&
                      menu.activeItem
                        ? menu.activeItemId
                        : undefined
                    }
                  />
                </PromptInputBody>
                <PromptInputFooter
                  ref={footerRef}
                  className="flex-nowrap gap-2"
                >
                  <div
                    ref={toolsRef}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <PromptInputTools className="shrink-0 flex-nowrap">
                      <PromptInputButton
                        type="button"
                        size="icon-sm"
                        aria-label={t.openMenu.value}
                        title={t.openMenu.value}
                        aria-haspopup="listbox"
                        aria-expanded={menu.open}
                        aria-controls={menu.open ? menu.listId : undefined}
                        data-input-menu-trigger
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={menu.toggle}
                      >
                        <PlusIcon aria-hidden="true" />
                      </PromptInputButton>
                      {showAttachments && Boolean(attachments?.length) && (
                        <PromptInputButton
                          type="button"
                          size={showToolLabels ? "sm" : "icon-sm"}
                          aria-label={t.addAttachment.value}
                          title={t.addAttachment.value}
                          disabled={!access.canUpload}
                          onClick={() => {
                            access.requireAccess("attachmentWrite");
                            promptInputRef.current?.openFileDialog();
                          }}
                        >
                          <PaperclipIcon aria-hidden="true" />
                          {showToolLabels && <span>{t.addAttachment}</span>}
                        </PromptInputButton>
                      )}
                      {showWorkspace && workspaceController && (
                        <PromptInputButton
                          type="button"
                          size={showToolLabels ? "sm" : "icon-sm"}
                          aria-label={workspaceLabel ?? t.workspace.value}
                          title={workspaceLabel ?? t.workspace.value}
                          aria-expanded={workspaceController?.workspaceOpen}
                          onClick={handleOpenWorkspace}
                        >
                          <FolderOpenIcon aria-hidden="true" />
                          {showToolLabels && (
                            <span>{workspaceLabel ?? t.workspace}</span>
                          )}
                        </PromptInputButton>
                      )}
                      {showThinkingToggle && selectedModel?.thinkingMode && (
                        <PromptInputButton
                          aria-label={t.thinking.value}
                          aria-pressed={thinking}
                          onClick={() => setThinking((prev) => !prev)}
                          size={showToolLabels ? "sm" : "icon-sm"}
                          title={t.thinking.value}
                          variant={thinking ? "default" : "ghost"}
                        >
                          <BrainIcon aria-hidden="true" />
                          {showToolLabels && <span>{t.thinking}</span>}
                        </PromptInputButton>
                      )}
                      {mode !== ChatInputMode.NORMAL && (
                        <>
                          {hasDefaultToolActions && (
                            <Separator
                              orientation="vertical"
                              // Separator 默认的 data-[orientation=vertical]:h-full 会在同层级的
                              // Tailwind 工具类中胜出，使百分比高度解析为 0；这里用同一变体声明固定高度。
                              className="mx-1 data-[orientation=vertical]:h-5 data-[orientation=vertical]:w-px"
                            />
                          )}
                          <PromptInputButton
                            type="button"
                            size={showToolLabels ? "sm" : "icon-sm"}
                            variant="ghost"
                            aria-pressed="true"
                            aria-label={
                              mode === ChatInputMode.PLAN
                                ? t.disablePlanMode.value
                                : t.disableGoalMode.value
                            }
                            title={
                              mode === ChatInputMode.PLAN
                                ? t.disablePlanMode.value
                                : t.disableGoalMode.value
                            }
                            className="group"
                            onClick={() => selectMode(ChatInputMode.NORMAL)}
                          >
                            <span className="group-hover:hidden group-focus-visible:hidden">
                              {mode === ChatInputMode.PLAN ? (
                                <ClipboardListIcon aria-hidden="true" />
                              ) : (
                                <TargetIcon aria-hidden="true" />
                              )}
                            </span>
                            <XIcon
                              aria-hidden="true"
                              className="hidden group-hover:block group-focus-visible:block"
                            />
                            {showToolLabels && (
                              <span>
                                {mode === ChatInputMode.PLAN
                                  ? t.planMode
                                  : t.goalMode}
                              </span>
                            )}
                          </PromptInputButton>
                        </>
                      )}
                    </PromptInputTools>
                    <div className="flex min-w-fit flex-1 items-center justify-end gap-1">
                      {showModelSelector && (
                        <AgentModelSelector
                          onModelChange={setSelectedModel}
                          className="min-w-28 max-w-40 shrink-0"
                        />
                      )}
                      {enableSpeech && (
                        <SpeechInput
                          className="shrink-0"
                          onTranscriptionChange={handleTranscriptionChange}
                          size="icon-sm"
                          variant="ghost"
                        />
                      )}
                      {showContextWindowUsage && hasContextUsage && (
                        <MessageContextUsageRing
                          isResponding={isResponding}
                          ratio={messageContextUsageRatio}
                          onRefresh={onRefreshContext}
                          onCompact={
                            access.canExecute ? onCompactContext : undefined
                          }
                        />
                      )}
                      {shouldShowStop ? (
                        <PromptInputButton
                          type="button"
                          aria-label={t.stopGeneration.value}
                          title={t.stopGeneration.value}
                          disabled={!access.canExecute}
                          onClick={() => {
                            access.requireAccess("execute");
                            onStop?.();
                          }}
                          size="icon-sm"
                          variant="outline"
                        >
                          <SquareIcon className="size-4" />
                        </PromptInputButton>
                      ) : (
                        <PromptInputSubmit
                          disabled={isSubmitDisabled}
                          status={effectiveStatus}
                          variant="brand"
                        />
                      )}
                    </div>
                  </div>
                  {access.decisionFor("submit") && (
                    <PermissionExplanation
                      decision={access.decisionFor("submit")!}
                      subject={placeholder ?? t.newConversation.value}
                    />
                  )}
                  {access.decisionFor("attachmentWrite") && (
                    <PermissionExplanation
                      decision={access.decisionFor("attachmentWrite")!}
                      subject={t.addAttachment.value}
                    />
                  )}
                  {access.decisionFor("execute") && (
                    <PermissionExplanation
                      decision={access.decisionFor("execute")!}
                      subject={t.stopGeneration.value}
                    />
                  )}
                </PromptInputFooter>
              </PromptInput>
            </div>
          </PopoverAnchor>
          {menu.open && (
            <PopoverContent
              align="start"
              collisionPadding={8}
              className="w-96 max-w-[calc(100vw-1rem)] p-1"
              onCloseAutoFocus={(event) => event.preventDefault()}
              onEscapeKeyDown={(event) => {
                event.preventDefault();
                menu.dismiss();
              }}
              onInteractOutside={(event) => {
                const target = event.target;
                if (
                  target instanceof Node &&
                  inputContainerRef.current?.contains(target)
                ) {
                  event.preventDefault();
                  if (
                    target instanceof Element &&
                    target.closest("[data-input-menu-trigger]")
                  )
                    return;
                  if (
                    textareaRef.current?.contains(target) &&
                    menu.source === InputMenuSource.Syntax
                  )
                    return;
                  menu.dismiss(false);
                  return;
                }
                menu.dismiss(false);
              }}
              onOpenAutoFocus={(event) => {
                if (menu.source === InputMenuSource.Syntax)
                  event.preventDefault();
              }}
              side="top"
              sideOffset={8}
            >
              <InputSuggestionMenu menu={menu} />
            </PopoverContent>
          )}
        </Popover>
      </div>
      <AlertDialog
        open={compactConfirmOpen}
        onOpenChange={handleCompactConfirmOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.compactContextTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.compactContextDescription({
                percentage: contextUsagePercentage ?? "--",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompactingContext}>
              {t.compactContextCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isCompactingContext || !access.canExecute}
              onClick={(event) => {
                event.preventDefault();
                void handleCompactContext();
              }}
            >
              {isCompactingContext && (
                <Loader2Icon className="size-4 animate-spin" />
              )}
              {isCompactingContext
                ? t.compactingContext
                : t.compactContextConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/**
 * 附件上传追踪器（不可见组件）
 *
 * 监听 PromptInput 中新添加的附件，立即触发文件上传，
 * 通过回调通知父组件上传进度和结果
 *
 * @param uploadFileAttachment - 上传函数
 * @param onStateChange - 上传状态变更回调
 */
function AttachmentUploadTracker({
  uploadFileAttachment,
  onStateChange,
}: {
  uploadFileAttachment: (file: File) => Promise<number>;
  onStateChange: (id: string, result: UploadResult) => void;
}) {
  const t = useAgentMessages("agents-chat-input");
  const attachments = usePromptInputAttachments();
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    if (!uploadFileAttachment) {
      throw new Error(
        "uploadFileAttachment is required when attachments are enabled, please inject it via AiChatContextProvider",
      );
    }

    const currentIds = new Set(attachments.files.map((f) => f.id));

    // 检测新添加的文件，触发上传
    for (const file of attachments.files) {
      if (seenRef.current.has(file.id)) continue;
      seenRef.current.add(file.id);

      onStateChange(file.id, { status: "uploading" });

      // 从 blob URL 恢复 File 对象并上传
      fetch(file.url)
        .then((r) => r.blob())
        .then(
          (blob) =>
            new File([blob], file.filename ?? "file", { type: file.mediaType }),
        )
        .then((fileObj) => uploadFileAttachment(fileObj))
        .then((fileId) => {
          onStateChange(file.id, { status: "success", fileId });
        })
        .catch((error) => {
          console.error("文件上传失败:", error);
          toast.error(t.fileUploadError);
          onStateChange(file.id, { status: "error" });
        });
    }

    // 清理已移除的附件的上传状态
    for (const id of seenRef.current) {
      if (!currentIds.has(id)) {
        seenRef.current.delete(id);
        onStateChange(id, { status: "removed" });
      }
    }
  }, [attachments.files]);

  return null;
}

function summarizeAttachmentName(name: string): string {
  const characters = Array.from(name);
  return characters.length > 64 ? `${characters.slice(0, 64).join("")}…` : name;
}

const VISIBLE_ATTACHMENT_COUNT = 3;

/** 在输入框头部展示已添加的附件列表，支持单个移除 */
const PromptInputAttachmentsDisplay = ({
  uploadResults,
}: {
  uploadResults: Map<string, UploadResult>;
}) => {
  const t = useAgentMessages("agents-chat-input");
  // 组件始终挂载，即使当前没有附件也提前加载附件字典，避免用户选择文件后才触发动态字典请求。
  const attachmentT = useAgentMessages("attachments");
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments],
  );

  if (attachments.files.length === 0) {
    return null;
  }

  const visibleAttachments = attachments.files.slice(
    0,
    VISIBLE_ATTACHMENT_COUNT,
  );
  const hiddenAttachmentCount =
    attachments.files.length - visibleAttachments.length;

  return (
    <PromptInputHeader className="items-start gap-2 pb-0">
      <Attachments variant="inline">
        {visibleAttachments.map((attachment) => (
          <AttachmentItem
            attachment={attachment}
            className="max-w-48 shrink-0"
            key={attachment.id}
            onRemove={handleRemove}
            removeLabel={attachmentT.remove.value}
            uploadStatus={uploadResults.get(attachment.id)?.status}
          />
        ))}
        {hiddenAttachmentCount > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={
                  t.viewAllAttachments({ count: attachments.files.length })
                    .value
                }
                className="shrink-0"
                size="sm"
                type="button"
                variant="outline"
              >
                {t.moreAttachments({ count: hiddenAttachmentCount })}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-96 max-w-[calc(100vw-2rem)] p-2"
              collisionPadding={8}
              side="top"
            >
              <p className="px-1 pb-2 text-sm font-medium">
                {t.allAttachments({ count: attachments.files.length })}
              </p>
              <Attachments
                className="max-h-72 overflow-y-auto pr-1"
                variant="list"
              >
                {attachments.files.map((attachment) => (
                  <AttachmentItem
                    attachment={attachment}
                    key={attachment.id}
                    onRemove={handleRemove}
                    removeLabel={attachmentT.remove.value}
                    uploadStatus={uploadResults.get(attachment.id)?.status}
                  />
                ))}
              </Attachments>
            </PopoverContent>
          </Popover>
        )}
      </Attachments>
    </PromptInputHeader>
  );
};
/** 单个附件项：预览 + 上传状态 + 删除按钮，图片/视频支持 HoverCard 悬停预览 */
const AttachmentItem = ({
  attachment,
  className,
  onRemove,
  removeLabel,
  uploadStatus,
}: {
  attachment: FileUIPart & { id: string };
  className?: string;
  onRemove: (id: string) => void;
  removeLabel: string;
  uploadStatus?: "uploading" | "success" | "error" | "removed";
}) => {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [onRemove, attachment.id]);

  const isUploading = uploadStatus === "uploading";
  const isError = uploadStatus === "error";
  const mediaCategory = getMediaCategory(attachment);
  const isPreviewable =
    (mediaCategory === "image" || mediaCategory === "video") && !isError;

  const content = (
    <Attachment
      data={attachment}
      onRemove={handleRemove}
      className={cn(
        className,
        isError && "border-destructive/50 bg-muted",
        isUploading && "opacity-70",
      )}
    >
      <AttachmentPreview className={cn(isError && "opacity-50")} />
      <AttachmentInfo />
      {isUploading && (
        <Loader2Icon className="size-3 animate-spin shrink-0 text-muted-foreground" />
      )}
      {!isUploading && (
        <AttachmentRemove
          className={cn(isError && "opacity-100 text-destructive")}
          label={removeLabel}
        />
      )}
    </Attachment>
  );

  if (!isPreviewable) return content;

  return (
    <AttachmentHoverCard>
      <AttachmentHoverCardTrigger>{content}</AttachmentHoverCardTrigger>
      <AttachmentHoverCardContent>
        {mediaCategory === "image" && (
          <img
            src={attachment.url}
            alt={attachment.filename}
            className="max-w-[300px] max-h-[300px] rounded object-contain"
          />
        )}
        {mediaCategory === "video" && (
          <video
            src={attachment.url}
            className="max-w-[300px] max-h-[300px] rounded"
            controls
            muted
          />
        )}
      </AttachmentHoverCardContent>
    </AttachmentHoverCard>
  );
};
