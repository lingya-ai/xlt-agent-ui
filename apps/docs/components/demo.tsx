"use client";
import {useMemo, useState} from "react";
import {useTheme} from "./theme";
import {AgentDemo, DemoMode} from "@xlt/registry/examples/demo";
import {createDemoClient} from "@xlt/registry/examples/mock-client";
import {AgentProvider} from "@xlt/registry/openapi/provider";
import {ConversationList} from "@xlt/registry/ai/agents/conversation-list";
import {AgentChat} from "@xlt/registry/blocks/agent-chat";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@xlt/registry/ui/components/tabs";
import type {ReactNode} from "react";
export function Demo({mode = "chat"}: {mode?: string}) {
  const {resolvedTheme, setTheme} = useTheme();
  const client = useMemo(() => createDemoClient(), []);
  const [conversationId, setConversationId] = useState<string | undefined>("demo");
  if (mode === "conversations") return <div className="conversation-preview agent-demo"><AgentProvider client={client} identityKey="docs-conversations"><ConversationList activeConversationId={conversationId} onConversationSelect={setConversationId} onNewConversation={() => setConversationId(undefined)}/><div className="conversation-chat"><AgentChat key={conversationId ?? "new"} conversationId={conversationId}/></div></AgentProvider></div>;
  return <AgentDemo theme={resolvedTheme === "dark" ? "dark" : "light"} onThemeChange={setTheme} initialMode={mode === "workspace" ? DemoMode.Workbench : mode === "goal" ? DemoMode.Goal : mode === "messages" ? DemoMode.History : DemoMode.Chat}/>;
}
export function PreviewTabs({mode, children}: {mode: string; children: ReactNode}) {
  return <Tabs defaultValue="preview" className="preview-tabs"><TabsList><TabsTrigger value="preview">预览</TabsTrigger><TabsTrigger value="code">代码</TabsTrigger></TabsList><TabsContent value="preview"><Demo mode={mode}/></TabsContent><TabsContent value="code">{children}</TabsContent></Tabs>;
}
