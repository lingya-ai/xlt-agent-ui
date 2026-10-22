"use client";
import {useEffect, useMemo, useState} from "react";
import {cn} from "../ui/lib/utils";
import {Toaster} from "sonner";
import {AgentProvider} from "../openapi/provider";
import {AgentChat} from "../blocks/agent-chat";
import {AgentChatWorkbench} from "../blocks/agent-chat-workbench";
import {AgentRichResultsProvider} from "../integration/rich-results";
import {AgentLocale} from "../i18n/runtime";
import {createDemoClient} from "./mock-client";
import {AgentGoalDemo} from "./goal-demo";

export enum DemoMode {Chat = "chat", Workbench = "workbench", History = "history", Goal = "goal"}
/** 普通聊天、完整工作台、只读历史和目标模式共用唯一 Registry 实现。 */
export function AgentDemo({initialMode = DemoMode.Chat, theme, onThemeChange}: {
  initialMode?: DemoMode;
  /** 可选受控主题，嵌入文档站时不修改宿主 html。 */
  theme?: "light" | "dark";
  onThemeChange?: (theme: "light" | "dark") => void;
} = {}) {
  const [mode, setMode] = useState(initialMode);
  const [locale, setLocale] = useState(AgentLocale.Zh);
  const [localDark, setDark] = useState(false);
  const dark = theme ? theme === "dark" : localDark;
  useEffect(() => {
    if (theme) return;
    const root = document.documentElement;
    const previous = root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    return () => { root.classList.toggle("dark", previous); };
  }, [dark, theme]);
  const client = useMemo(() => createDemoClient(), []);
  const en = locale === AgentLocale.En;
  return <section className={cn("agent-demo", dark && "dark")} aria-label={en ? "Interactive demo" : "交互演示"}>
    <div className="demo-controls">
      <label>{en ? "Example" : "组合示例"} <select value={mode} onChange={e => setMode(e.target.value as DemoMode)}>
        <option value={DemoMode.Chat}>{en ? "Chat" : "普通聊天"}</option>
        <option value={DemoMode.Workbench}>{en ? "Workbench" : "完整工作台"}</option>
        <option value={DemoMode.History}>{en ? "Read-only history" : "历史只读"}</option>
        <option value={DemoMode.Goal}>{en ? "Goal lifecycle" : "目标模式"}</option>
      </select></label>
      <button type="button" onClick={() => setLocale(en ? AgentLocale.Zh : AgentLocale.En)}>{en ? "中文" : "English"}</button>
      <button type="button" onClick={() => theme ? onThemeChange?.(dark ? "light" : "dark") : setDark(!dark)}>{en ? "Theme" : "切换主题"}</button>
      <span className="demo-status">{en ? "Local simulation" : "本地模拟"}</span>
    </div>
    <div className="demo-surface" data-testid="demo-surface">
      <AgentRichResultsProvider><AgentProvider client={client} identityKey="demo" locale={locale}>
        {mode === DemoMode.Goal ? <AgentGoalDemo initialConversationId="demo" simulated/> :
          mode === DemoMode.Workbench ? <AgentChatWorkbench initialConversationId="demo"/> :
          <AgentChat key={mode} conversationId={mode === DemoMode.History ? "demo" : undefined}
            readOnly={mode === DemoMode.History} emptyState={{title: en ? "What shall we work on?" : "开始一次 Agent 对话",
              description: en ? "Try the source components with simulated events" : "输入消息，体验源码组件与本地模拟事件"}}/>}
      </AgentProvider></AgentRichResultsProvider>
    </div>
    <Toaster richColors/>
  </section>;
}

/** 文档目标页复用相同演示入口。 */
export function AgentGoalExample() { return <AgentDemo initialMode={DemoMode.Goal}/>; }
