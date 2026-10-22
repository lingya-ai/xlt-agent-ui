"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {cn} from "../../ui/lib/utils";
import type {PreviewerDefinition, PreviewerProps} from "../../file-preview/types";
import {PreviewError} from "../../file-preview/components/preview-error";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewConsole,
} from "../components/web-preview";
import {
  createWorkspaceHtmlConsoleChannel,
  injectWorkspaceHtmlConsoleBridge,
  isWorkspaceHtmlConsoleMessage,
  MAX_WORKSPACE_HTML_CONSOLE_LOGS,
  type WorkspaceHtmlConsoleLog,
} from "./workspace-html-console";

function WorkspaceHtmlPreview({ source, fileName, className }: PreviewerProps) {
  const consoleChannel = useRef(createWorkspaceHtmlConsoleChannel()).current;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleReady, setConsoleReady] = useState(false);
  const [logs, setLogs] = useState<WorkspaceHtmlConsoleLog[]>([]);
  const { content, error } = useMemo(() => {
    try {
      const html = new TextDecoder("utf-8", { fatal: false }).decode(
        new Uint8Array(source),
      );
      return {
        content: injectWorkspaceHtmlConsoleBridge(html, consoleChannel),
      };
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }, [consoleChannel, source]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isWorkspaceHtmlConsoleMessage(message, consoleChannel)) return;

      setLogs((current) => [
        ...current.slice(-(MAX_WORKSPACE_HTML_CONSOLE_LOGS - 1)),
        {
          level: message.level,
          message: message.message,
          timestamp: new Date(),
        },
      ]);
    };

    window.addEventListener("message", handleMessage);
    setConsoleReady(true);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [consoleChannel]);

  useEffect(() => {
    setLogs([]);
  }, [source]);

  if (error)
    return <PreviewError error={error} variant="parse" className={className} />;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <WebPreview className="min-h-0 flex-1 !h-auto rounded-none border-0">
        <WebPreviewBody
          ref={iframeRef}
          srcDoc={consoleReady ? content : undefined}
          // 使用 WebPreview 默认 sandbox，支持单文件 HTML 的脚本、表单、弹窗和演示能力。
          referrerPolicy="no-referrer"
          data-file-previewer="workspace-html"
          className="border-0"
          title={fileName ?? "HTML"}
        />
        <WebPreviewConsole logs={logs} />
      </WebPreview>
    </div>
  );
}

/**
 * AI 工作区专用预览器，由 FilePreview 的 previewers 入参注入。
 *
 * 复用 WebPreview 的默认 iframe 权限，支持单文件 HTML 的脚本和交互能力，
 * 并将页面的 console 输出与运行时异常回传到 WebPreviewConsole。
 */
export const workspaceFilePreviewers = [
  {
    kind: "html",
    extensions: ["html", "htm"],
    mimeTypes: ["text/html", "application/xhtml+xml"],
    Component: WorkspaceHtmlPreview,
  },
] satisfies readonly PreviewerDefinition[];
