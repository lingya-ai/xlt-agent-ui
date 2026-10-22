"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  Maximize2Icon,
  Minimize2Icon,
  RefreshCcwIcon,
} from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import { Skeleton } from "../../ui/components/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../ui/components/resizable";
import { cn } from "../../ui/lib/utils";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "../components/web-preview";
import { getDiagramPreviewFeedback } from "./diagram-preview-feedback";
import { getDiagramPreviewPermissions } from "./diagram-preview-permissions";
import type { WorkspaceNonFileArtifact } from "../hooks/use-chat/workspace-non-file-artifact-schema";
import { useOptionalAiChatContextEvent } from "./events";
import {
  createWorkspaceHtmlConsoleChannel,
  createWorkspaceHtmlPreviewEmbedUrl,
  getWorkspaceHtmlPreviewOrigin,
  isWorkspaceHtmlPreviewMessage,
  MAX_WORKSPACE_HTML_CONSOLE_LOGS,
  sanitizeWorkspaceHtmlPreviewUrl,
  type WorkspaceHtmlConsoleLog,
  type WorkspaceHtmlPreviewEvent,
  type WorkspaceHtmlPreviewMessage,
} from "./workspace-html-console";
import { getWorkspaceNonFileArtifactPreviewUrl } from "./workspace-non-file-artifact-utils";

interface HtmlPageWebPreviewProps {
  /** 宿主明确启用图表导出；公开 SDK 不返回此能力。 */
  authoringMode?: import("../hooks/use-chat/workspace-non-file-artifact-schema").HtmlPageAuthoringModeEnum;
  artifact: WorkspaceNonFileArtifact;
  refreshToken: number;
}

type HtmlPageHistoryState = {
  entries: string[];
  cursor: number;
};

type PreviewNavigationMode = "push" | "replace" | "pop";

/** HTML 页面制品预览，支持导航历史、独立 Origin 控制台采集和全屏查看。 */
export function HtmlPageWebPreview({
  artifact,
  refreshToken,
  authoringMode,
}: HtmlPageWebPreviewProps) {
  const t = useAgentMessages("workspace-artifact-list");
  const aiChatEvents = useOptionalAiChatContextEvent();
  const previewUrl = getWorkspaceNonFileArtifactPreviewUrl(artifact);
  const previewBridgeConnectedText = t.previewBridgeConnected.value;
  const networkRequestFailedText = t.networkRequestFailed.value;
  const previewOrigin = previewUrl
    ? getWorkspaceHtmlPreviewOrigin(previewUrl)
    : undefined;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewSessionId = useRef(createWorkspaceHtmlConsoleChannel()).current;
  const [parentOrigin, setParentOrigin] = useState("");
  const [activeUrl, setActiveUrl] = useState(() => previewUrl ?? "");
  const [iframeTargetUrl, setIframeTargetUrl] = useState(
    () => previewUrl ?? "",
  );
  const [historyState, setHistoryState] = useState<HtmlPageHistoryState>(() =>
    previewUrl
      ? { entries: [previewUrl], cursor: 0 }
      : { entries: [], cursor: -1 },
  );
  const [logs, setLogs] = useState<WorkspaceHtmlConsoleLog[]>([]);
  const [diagramFeedback, setDiagramFeedback] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const externalUrl = getHttpUrl(activeUrl);
  const iframeUrl = parentOrigin
    ? createWorkspaceHtmlPreviewEmbedUrl(
        iframeTargetUrl,
        previewSessionId,
        parentOrigin,
      )
    : undefined;
  const diagramPermissions = getDiagramPreviewPermissions(
    authoringMode,
    previewUrl,
    iframeTargetUrl,
  );
  const frameKey = `${artifact.artifactId}:${refreshToken}:${reloadKey}:${parentOrigin}:${iframeTargetUrl}`;
  const [loadedFrameKey, setLoadedFrameKey] = useState<string>();
  const isFrameLoading = loadedFrameKey !== frameKey;

  const appendConsoleLog = useCallback(
    (
      level: WorkspaceHtmlConsoleLog["level"],
      message: string,
      timestamp = new Date(),
    ) => {
      setLogs((previous) => [
        ...previous.slice(-(MAX_WORKSPACE_HTML_CONSOLE_LOGS - 1)),
        { level, message, timestamp },
      ]);
    },
    [],
  );

  const updatePreviewNavigation = useCallback(
    (value: string, mode: PreviewNavigationMode) => {
      const nextUrl = sanitizeWorkspaceHtmlPreviewUrl(value);
      if (!nextUrl || !previewOrigin) return;
      if (getWorkspaceHtmlPreviewOrigin(nextUrl) !== previewOrigin) return;

      setActiveUrl(nextUrl);
      setHistoryState((previous) => {
        if (mode === "replace") {
          if (previous.cursor < 0) {
            return { entries: [nextUrl], cursor: 0 };
          }
          const entries = [...previous.entries];
          entries[previous.cursor] = nextUrl;
          return { entries, cursor: previous.cursor };
        }

        if (mode === "pop") {
          const existingIndex = previous.entries.lastIndexOf(nextUrl);
          if (existingIndex >= 0) {
            return { ...previous, cursor: existingIndex };
          }
        }

        if (previous.entries[previous.cursor] === nextUrl) return previous;
        const entries = previous.entries.slice(0, previous.cursor + 1);
        return {
          entries: [...entries, nextUrl],
          cursor: entries.length,
        };
      });
    },
    [previewOrigin],
  );

  const navigateIframe = (value: string, mode: PreviewNavigationMode) => {
    const nextUrl = resolveSameOriginPreviewUrl(
      value,
      activeUrl,
      previewOrigin,
    );
    if (!nextUrl) return;

    updatePreviewNavigation(nextUrl, mode);
    setIframeTargetUrl(nextUrl);
  };

  const handleUrlChange = (url: string) => navigateIframe(url, "push");

  const handleGoBack = () => {
    const nextUrl = historyState.entries[historyState.cursor - 1];
    if (!nextUrl) return;

    setActiveUrl(nextUrl);
    setIframeTargetUrl(nextUrl);
    setHistoryState((previous) => ({
      ...previous,
      cursor: previous.cursor - 1,
    }));
  };

  const handleGoForward = () => {
    const nextUrl = historyState.entries[historyState.cursor + 1];
    if (!nextUrl) return;

    setActiveUrl(nextUrl);
    setIframeTargetUrl(nextUrl);
    setHistoryState((previous) => ({
      ...previous,
      cursor: previous.cursor + 1,
    }));
  };

  const handleReload = () => {
    setLogs([]);
    setIframeTargetUrl(activeUrl);
    setReloadKey((current) => current + 1);
  };

  const handleRequestAiFix = () => {
    if (!aiChatEvents) return;

    const diagnosticLogs = logs.filter(
      (log) => log.level === "error" || log.level === "warn",
    );
    if (!diagnosticLogs.some((log) => log.level === "error")) return;

    aiChatEvents.chatInputTextInsertEvent.emit({
      text: buildAiFixPrompt(activeUrl, diagnosticLogs, {
        instruction: t.aiFixPromptInstruction.value,
        pageLabel: t.aiFixPromptPage.value,
        logsLabel: t.aiFixPromptLogs.value,
        errorLabel: t.errorLogLevel.value,
        warningLabel: t.warningLogLevel.value,
      }),
    });
  };

  const handleOpenInNewTab = () => {
    if (externalUrl) window.open(externalUrl, "_blank", "noopener,noreferrer");
  };

  const handleFrameLoad = () => setLoadedFrameKey(frameKey);

  useLayoutEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!previewOrigin || event.origin !== previewOrigin) return;
      if (!isWorkspaceHtmlPreviewMessage(event.data, previewSessionId)) return;

      const message = event.data;
      if (getWorkspaceHtmlPreviewOrigin(message.pageUrl) !== previewOrigin) {
        return;
      }
      const feedback = getDiagramPreviewFeedback(
        authoringMode,
        message.event,
      );
      if (feedback) setDiagramFeedback(feedback);
      handlePreviewEvent(message, {
        appendConsoleLog,
        markLoading: () => setLoadedFrameKey(undefined),
        markReady: () => setLoadedFrameKey(frameKey),
        navigate: updatePreviewNavigation,
        previewBridgeConnectedText,
        networkRequestFailedText,
      });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    appendConsoleLog,
    authoringMode,
    frameKey,
    networkRequestFailedText,
    previewBridgeConnectedText,
    previewOrigin,
    previewSessionId,
    updatePreviewNavigation,
  ]);

  useEffect(() => {
    setDiagramFeedback(undefined);
  }, [frameKey]);

  useEffect(() => {
    setParentOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const nextUrl = previewUrl ?? "";
    setActiveUrl(nextUrl);
    setIframeTargetUrl(nextUrl);
    setHistoryState(
      nextUrl ? { entries: [nextUrl], cursor: 0 } : { entries: [], cursor: -1 },
    );
    setLogs([]);
    setReloadKey(0);
    setIsFullscreen(false);
    setConsoleOpen(false);
  }, [previewUrl]);

  useEffect(() => {
    setLogs([]);
  }, [refreshToken]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  if (!previewUrl) return null;

  const fullscreenLabel = isFullscreen
    ? t.restorePreview.value
    : t.maximize.value;

  return (
    <WebPreview
      className={cn(
        "min-h-0 flex-1 rounded-none border-0",
        isFullscreen &&
          "fixed inset-0 z-50 h-screen w-screen bg-background shadow-2xl",
      )}
      url={activeUrl}
      onUrlChange={handleUrlChange}
      consoleOpen={consoleOpen}
      onConsoleOpenChange={setConsoleOpen}
    >
      <ResizablePanelGroup direction="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={consoleOpen ? 70 : 100} minSize={30}>
          <div className="flex h-full min-h-0 flex-col">
            <WebPreviewNavigation className="h-12 shrink-0 px-3 py-2">
              <WebPreviewNavigationButton
                onClick={handleGoBack}
                disabled={historyState.cursor <= 0}
                tooltip={t.goBack.value}
                aria-label={t.goBack.value}
              >
                <ArrowLeftIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewNavigationButton
                onClick={handleGoForward}
                disabled={
                  historyState.cursor >= historyState.entries.length - 1
                }
                tooltip={t.goForward.value}
                aria-label={t.goForward.value}
              >
                <ArrowRightIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewNavigationButton
                tooltip={t.reloadPreview.value}
                aria-label={t.reloadPreview.value}
                onClick={handleReload}
              >
                <RefreshCcwIcon
                  className={cn(
                    "size-4",
                    isFrameLoading && "animate-spin motion-reduce:animate-none",
                  )}
                />
              </WebPreviewNavigationButton>
              <WebPreviewUrl />
              <WebPreviewNavigationButton
                tooltip={t.openInNewTab.value}
                aria-label={t.openInNewTab.value}
                disabled={!externalUrl}
                onClick={handleOpenInNewTab}
              >
                <ExternalLinkIcon className="size-4" />
              </WebPreviewNavigationButton>
              <WebPreviewNavigationButton
                onClick={() => setIsFullscreen((previous) => !previous)}
                tooltip={fullscreenLabel}
                aria-label={fullscreenLabel}
                aria-pressed={isFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2Icon className="size-4" />
                ) : (
                  <Maximize2Icon className="size-4" />
                )}
              </WebPreviewNavigationButton>
            </WebPreviewNavigation>

            {diagramFeedback && (
              <div
                role="alert"
                className="border-b border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {diagramFeedback}
              </div>
            )}
            <WebPreviewBody
              ref={iframeRef}
              src={iframeUrl ?? "about:blank"}
              onLoad={handleFrameLoad}
              key={frameKey}
              sandbox={diagramPermissions.sandbox}
              allow={diagramPermissions.allow}
              referrerPolicy="no-referrer"
              name={`workspace-html-preview-${previewSessionId}`}
              loading={
                isFrameLoading ? (
                  <div
                    className="absolute inset-0 flex flex-col gap-6 bg-background p-6"
                    aria-hidden="true"
                  >
                    <div className="flex flex-col gap-3">
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                    <Skeleton className="min-h-0 flex-1 rounded-lg" />
                  </div>
                ) : null
              }
            />
          </div>
        </ResizablePanel>
        {consoleOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={12}>
              <WebPreviewConsole
                className="flex h-full min-h-0 flex-col"
                logs={logs}
                onRequestAiFix={handleRequestAiFix}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {!consoleOpen && (
        <WebPreviewConsole logs={logs} onRequestAiFix={handleRequestAiFix} />
      )}
    </WebPreview>
  );
}

function buildAiFixPrompt(
  pageUrl: string,
  logs: WorkspaceHtmlConsoleLog[],
  labels: {
    instruction: string;
    pageLabel: string;
    logsLabel: string;
    errorLabel: string;
    warningLabel: string;
  },
): string {
  const formattedLogs = logs
    .map((log) => {
      const levelLabel =
        log.level === "error" ? labels.errorLabel : labels.warningLabel;
      return `[${levelLabel}] ${log.timestamp.toISOString()} ${log.message}`;
    })
    .join("\n");

  return `${labels.instruction}\n\n${labels.pageLabel}: ${pageUrl}\n${labels.logsLabel}:\n${formattedLogs}`;
}

function handlePreviewEvent(
  message: WorkspaceHtmlPreviewMessage,
  actions: {
    appendConsoleLog: (
      level: WorkspaceHtmlConsoleLog["level"],
      text: string,
      timestamp?: Date,
    ) => void;
    markLoading: () => void;
    markReady: () => void;
    navigate: (url: string, mode: PreviewNavigationMode) => void;
    previewBridgeConnectedText: string;
    networkRequestFailedText: string;
  },
) {
  const event = message.event;
  const timestamp = new Date(message.timestamp);

  switch (event.kind) {
    case "loading":
      actions.markLoading();
      break;
    case "ready":
      actions.markReady();
      actions.navigate(event.url, "push");
      actions.appendConsoleLog(
        "log",
        `${actions.previewBridgeConnectedText}: ${event.url}`,
        timestamp,
      );
      break;
    case "navigation":
      actions.navigate(event.url, event.navigationType);
      break;
    case "console":
      actions.appendConsoleLog(
        event.level === "warn"
          ? "warn"
          : event.level === "error"
            ? "error"
            : "log",
        event.message,
        timestamp,
      );
      break;
    case "runtime-error":
      actions.appendConsoleLog("error", formatRuntimeError(event), timestamp);
      break;
    case "unhandled-rejection":
      actions.appendConsoleLog(
        "error",
        `未处理的 Promise 拒绝: ${event.message}`,
        timestamp,
      );
      break;
    case "resource-error":
      actions.appendConsoleLog(
        "error",
        `${event.message}${event.tagName ? ` <${event.tagName}>` : ""}${event.url ? `: ${event.url}` : ""}`,
        timestamp,
      );
      break;
    case "network":
      actions.appendConsoleLog(
        event.ok ? "log" : "error",
        formatNetworkEvent(event, actions.networkRequestFailedText),
        timestamp,
      );
      break;
  }
}

function formatRuntimeError(
  event: Extract<WorkspaceHtmlPreviewEvent, { kind: "runtime-error" }>,
): string {
  const location = event.filename
    ? ` (${event.filename}:${event.line}:${event.column})`
    : "";
  if (!event.stack || event.stack.includes(event.message)) {
    return `${event.message}${location}`;
  }
  return `${event.message}${location}\n${event.stack}`;
}

function formatNetworkEvent(
  event: Extract<WorkspaceHtmlPreviewEvent, { kind: "network" }>,
  requestFailedText: string,
): string {
  const result =
    event.status > 0 ? String(event.status) : event.error || requestFailedText;
  return `${event.method} ${event.url} → ${result} (${event.duration}ms)`;
}

function resolveSameOriginPreviewUrl(
  value: string,
  baseUrl: string,
  expectedOrigin: string | undefined,
): string | undefined {
  if (!expectedOrigin) return undefined;
  try {
    const url = new URL(value.trim(), baseUrl);
    if (url.origin !== expectedOrigin) return undefined;
    return sanitizeWorkspaceHtmlPreviewUrl(url.toString());
  } catch {
    return undefined;
  }
}

function getHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
