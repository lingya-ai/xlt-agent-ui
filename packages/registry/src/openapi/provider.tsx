"use client";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {clearChatClientCache} from "../ai/lib/chat-client-cache-key";
import { toast } from "sonner";
import { TooltipProvider } from "../ui/components/tooltip";
import { setApiNotifier } from "../api/hooks/use-api-request";
import { AiChatContextProvider, type AiChatContextOptions } from "../ai/agents/context";
import { AgentMessagesProvider, AgentLocale, type AgentMessageOverrides } from "../i18n/runtime";
import type { AgentsClient } from "@lingya-ai/agents-sdk/browser";

let nextScope = 0;

export interface AgentProviderProps {
  client: AgentsClient;
  /** 用户或渠道变化时必须变化，强制释放旧聊天子树。 */
  identityKey: string;
  locale?: AgentLocale;
  messages?: AgentMessageOverrides;
  options?: Omit<AiChatContextOptions, "httpClient">;
  children: ReactNode;
}
function Session({ client, options, children }: Pick<AgentProviderProps, "client" | "options" | "children">) {
  const lifecycle = useRef(0);
  const controller = useMemo(() => new AbortController(), [client]);
  useEffect(() => {
    ++lifecycle.current;
    return () => {
      const generation = ++lifecycle.current;
      // StrictMode 会立即重新执行 effect；真正卸载才释放网络资源。
      queueMicrotask(() => { if (lifecycle.current === generation) { controller.abort(); clearChatClientCache(controller.signal); } });
    };
  }, [client]);
  useEffect(() => { setApiNotifier({ error: toast.error, warning: toast.warning, success: toast.success }); }, []);
  return <AiChatContextProvider value={{ ...options, httpClient: client, signal: controller.signal, streamTransport: options?.streamTransport ?? "sse" }}>
    {children}
  </AiChatContextProvider>;
}
/** 身份或渠道切换重建状态并释放旧请求；外部客户端仍可独立使用。 */
export function AgentProvider({ client, identityKey, locale, messages, options, children }: AgentProviderProps) {
  const scope = useMemo(() => ({client, key: ++nextScope}), [client, identityKey]);
  return <AgentMessagesProvider locale={locale} messages={messages}>
    <TooltipProvider><Session key={scope.key} client={scope.client} options={options}>{children}</Session></TooltipProvider>
  </AgentMessagesProvider>;
}
