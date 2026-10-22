export type WorkspaceHtmlConsoleLog = {
  level: "log" | "warn" | "error";
  message: string;
  timestamp: Date;
};

export type WorkspaceHtmlConsoleMessage = {
  type: "workspace-html-console";
  channel: string;
  level: WorkspaceHtmlConsoleLog["level"];
  message: string;
};

export type WorkspaceHtmlPreviewEvent =
  | {
      kind: "loading";
    }
  | {
      kind: "ready";
      url: string;
    }
  | {
      kind: "console";
      level: "debug" | "log" | "info" | "warn" | "error";
      message: string;
    }
  | {
      kind: "runtime-error";
      message: string;
      stack: string;
      filename: string;
      line: number;
      column: number;
    }
  | {
      kind: "unhandled-rejection";
      message: string;
    }
  | {
      kind: "resource-error";
      message: string;
      url: string;
      tagName: string;
    }
  | {
      kind: "network";
      transport: "fetch" | "xhr";
      method: string;
      url: string;
      status: number;
      ok: boolean;
      duration: number;
      error: string;
    }
  | {
      kind: "navigation";
      navigationType: "push" | "replace" | "pop";
      url: string;
    };

export type WorkspaceHtmlPreviewMessage = {
  namespace: typeof WORKSPACE_HTML_PREVIEW_NAMESPACE;
  version: typeof WORKSPACE_HTML_PREVIEW_PROTOCOL_VERSION;
  sessionId: string;
  sequence: number;
  timestamp: number;
  pageUrl: string;
  event: WorkspaceHtmlPreviewEvent;
};

export const MAX_WORKSPACE_HTML_CONSOLE_LOGS = 200;
export const WORKSPACE_HTML_PREVIEW_NAMESPACE = "xiaolingtong.html-preview";
export const WORKSPACE_HTML_PREVIEW_PROTOCOL_VERSION = 1;

const EMBED_PARAMETER = "__xlt_embed";
const SESSION_PARAMETER = "__xlt_session";
const PARENT_ORIGIN_PARAMETER = "__xlt_parent_origin";

/** 创建仅用于父页面与 iframe 之间匹配控制台事件的随机会话。 */
export function createWorkspaceHtmlConsoleChannel(): string {
  return `workspace-html-console-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 为独立预览 Origin 追加一次嵌入会话参数。 */
export function createWorkspaceHtmlPreviewEmbedUrl(
  url: string,
  sessionId: string,
  parentOrigin: string,
): string | undefined {
  try {
    const previewUrl = new URL(url);
    const parentUrl = new URL(parentOrigin);
    if (!isHttpUrl(previewUrl) || !isHttpUrl(parentUrl)) return undefined;
    if (parentUrl.pathname !== "/" || parentUrl.search || parentUrl.hash) {
      return undefined;
    }

    previewUrl.searchParams.set(EMBED_PARAMETER, "1");
    previewUrl.searchParams.set(SESSION_PARAMETER, sessionId);
    previewUrl.searchParams.set(PARENT_ORIGIN_PARAMETER, parentUrl.origin);
    return previewUrl.toString();
  } catch {
    return undefined;
  }
}

/** 移除只用于建立 iframe 会话的内部查询参数。 */
export function sanitizeWorkspaceHtmlPreviewUrl(
  value: string,
): string | undefined {
  try {
    const url = new URL(value);
    if (!isHttpUrl(url)) return undefined;
    url.searchParams.delete(EMBED_PARAMETER);
    url.searchParams.delete(SESSION_PARAMETER);
    url.searchParams.delete(PARENT_ORIGIN_PARAMETER);
    return url.toString();
  } catch {
    return undefined;
  }
}

/** 返回 HTTP(S) 地址的精确 Origin。 */
export function getWorkspaceHtmlPreviewOrigin(
  value: string,
): string | undefined {
  try {
    const url = new URL(value);
    return isHttpUrl(url) ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 为已读取到内存的单文件 HTML 注入基础 console bridge。
 *
 * 单文件预览使用 srcDoc，不经过独立预览服务，因此保留这套局部协议；远程 HTML 页面使用
 * [WorkspaceHtmlPreviewMessage] 对应的独立 Origin 协议。
 */
export function injectWorkspaceHtmlConsoleBridge(
  html: string,
  channel: string,
): string {
  const serializedChannel = JSON.stringify(channel).replaceAll("<", "\\u003c");
  const bridge = `<script>(function () {
  var channel = ${serializedChannel};
  var serialize = function (value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try {
      var serialized = JSON.stringify(value);
      return serialized === undefined ? String(value) : serialized;
    } catch (error) {
      return String(value);
    }
  };
  var send = function (level, args) {
    try {
      var message = Array.prototype.map.call(args, serialize).join(' ');
      window.parent.postMessage({ type: 'workspace-html-console', channel: channel, level: level, message: message }, '*');
    } catch (error) {}
  };
  ['log', 'info', 'debug', 'warn', 'error'].forEach(function (method) {
    var level = method === 'warn' || method === 'error' ? method : 'log';
    var original = window.console && window.console[method];
    if (!original) return;
    window.console[method] = function () {
      send(level, arguments);
      return original.apply(window.console, arguments);
    };
  });
  window.addEventListener('error', function (event) {
    send('error', [event.error || event.message || '页面运行时错误']);
  });
  window.addEventListener('unhandledrejection', function (event) {
    send('error', [event.reason]);
  });
})();</script>`;
  const headMatch = /<head\b[^>]*>/i.exec(html);
  if (!headMatch || headMatch.index === undefined) return `${bridge}${html}`;

  const insertAt = headMatch.index + headMatch[0].length;
  return `${html.slice(0, insertAt)}${bridge}${html.slice(insertAt)}`;
}

/** 判断来自独立预览 Origin 的消息是否符合版本化协议。 */
export function isWorkspaceHtmlPreviewMessage(
  value: unknown,
  sessionId: string,
): value is WorkspaceHtmlPreviewMessage {
  if (!isRecord(value)) return false;
  if (
    value.namespace !== WORKSPACE_HTML_PREVIEW_NAMESPACE ||
    value.version !== WORKSPACE_HTML_PREVIEW_PROTOCOL_VERSION ||
    value.sessionId !== sessionId ||
    !isFiniteNumber(value.sequence) ||
    value.sequence < 1 ||
    !isFiniteNumber(value.timestamp) ||
    !isBoundedString(value.pageUrl, 8_192) ||
    !isRecord(value.event)
  ) {
    return false;
  }

  return isWorkspaceHtmlPreviewEvent(value.event);
}

/** 判断来自 srcDoc iframe 的消息是否符合单文件控制台协议。 */
export function isWorkspaceHtmlConsoleMessage(
  value: unknown,
  channel: string,
): value is WorkspaceHtmlConsoleMessage {
  if (!isRecord(value)) return false;

  return (
    value.type === "workspace-html-console" &&
    value.channel === channel &&
    (value.level === "log" ||
      value.level === "warn" ||
      value.level === "error") &&
    typeof value.message === "string"
  );
}

function isWorkspaceHtmlPreviewEvent(
  event: Record<string, unknown>,
): event is WorkspaceHtmlPreviewEvent {
  switch (event.kind) {
    case "loading":
      return true;
    case "ready":
      return isBoundedString(event.url, 8_192);
    case "console":
      return (
        (event.level === "debug" ||
          event.level === "log" ||
          event.level === "info" ||
          event.level === "warn" ||
          event.level === "error") &&
        isBoundedString(event.message, 20_000)
      );
    case "runtime-error":
      return (
        isBoundedString(event.message, 20_000) &&
        isBoundedString(event.stack, 50_000) &&
        isBoundedString(event.filename, 8_192) &&
        isFiniteNumber(event.line) &&
        isFiniteNumber(event.column)
      );
    case "unhandled-rejection":
      return isBoundedString(event.message, 20_000);
    case "resource-error":
      return (
        isBoundedString(event.message, 20_000) &&
        isBoundedString(event.url, 8_192) &&
        isBoundedString(event.tagName, 64)
      );
    case "network":
      return (
        (event.transport === "fetch" || event.transport === "xhr") &&
        isBoundedString(event.method, 32) &&
        isBoundedString(event.url, 8_192) &&
        isFiniteNumber(event.status) &&
        typeof event.ok === "boolean" &&
        isFiniteNumber(event.duration) &&
        isBoundedString(event.error, 20_000)
      );
    case "navigation":
      return (
        (event.navigationType === "push" ||
          event.navigationType === "replace" ||
          event.navigationType === "pop") &&
        isBoundedString(event.url, 8_192)
      );
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}
