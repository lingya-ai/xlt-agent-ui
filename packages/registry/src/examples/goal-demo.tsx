"use client";
import {useId, useState} from "react";
import {useAgentMessages} from "../i18n/runtime";
import {useApiRequest} from "../api/hooks/use-api-request";
import {useAiChatContext} from "../ai/agents/context";
import {useAiChatAccess} from "../ai/agents/use-ai-chat-access";
import {useAgentGoal} from "../ai/hooks/use-chat/use-agent-goal";
import {useAgentsConfig} from "../ai/hooks/use-chat/use-agents-config";
import {AgentGoalBar} from "../ai/agents/agent-goal-bar";
import {AgentGoalDetails} from "../ai/agents/agent-goal-details";
import {Button} from "../ui/components/button";
import {Label} from "../ui/components/label";
import {Textarea} from "../ui/components/textarea";
import {Alert, AlertDescription} from "../ui/components/alert";
import {toast} from "../ui/components/sonner";

/** 通过真实 Hook 和组件演示目标控制；创建仍走聊天 goalMode，不增设虚构接口。 */
export function AgentGoalDemo({initialConversationId, simulated = false}: {
  initialConversationId?: string; simulated?: boolean;
}) {
  const t = useAgentMessages("goal-demo");
  const inputId = useId();
  const {httpClient, signal} = useAiChatContext();
  const access = useAiChatAccess();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [objective, setObjective] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const config = useApiRequest(useAgentsConfig({httpClient}));
  const goalConfig = config.data?.goal;
  const controller = useAgentGoal({httpClient, conversationId,
    enabled: Boolean(goalConfig?.supported && access.canRead), executionActive: false,
    requireAccess: () => access.requireAccess("execute")});
  const create = useApiRequest(async () => {
    access.requireAccess("submit"); access.requireAccess("execute");
    const input = {query: objective.trim(), goalMode: true};
    return conversationId ? httpClient.chat.continueChat(conversationId, input, {signal}) : httpClient.chat.createChat(input, {signal});
  }, {manual: true, disableErrorNotification: true, onSuccess: result => {
    setConversationId(result.conversationId); setObjective(""); setHistoryVersion(version => version + 1); toast.success(t.created.value);
    // 同一会话创建新目标时主动读取；新会话由 Hook 的作用域变化触发读取。
    if (result.conversationId === conversationId) void controller.refresh().catch(() => {});
  }});
  const failure = create.error ?? config.error ?? controller.error;
  return <section className="flex h-full min-h-0 flex-col" data-testid="goal-demo" aria-label={t.title.value}>
    <div className="flex shrink-0 flex-col gap-3 border-b p-4">
      <h2 className="m-0 text-base font-semibold">{t.title}</h2>
      <p className="text-sm text-muted-foreground">{simulated ? t.simulation : t.description}</p>
      <form className="flex flex-col gap-2" onSubmit={event => {event.preventDefault(); create.run();}}>
        <Label htmlFor={inputId}>{t.objective}</Label>
        <Textarea id={inputId} value={objective} onChange={event => setObjective(event.target.value)}
          required maxLength={4000} rows={2} className="h-20 resize-none" placeholder={t.placeholder.value}
          disabled={create.loading || Boolean(controller.goal)}/>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!objective.trim() || !goalConfig?.supported || Boolean(controller.goal) || create.loading || !access.canSubmit || !access.canExecute}>
            {create.loading ? t.creating : t.create}
          </Button>
          <Button type="button" variant="outline" disabled={!conversationId || controller.loading}
            onClick={() => {void controller.refresh().catch(() => {});}}>{t.refresh}</Button>
          {!config.loading && !goalConfig?.supported && <p className="text-sm text-muted-foreground">{t.unsupported}</p>}
        </div>
      </form>
      {failure && <Alert variant="destructive"><AlertDescription>{failure.message}</AlertDescription></Alert>}
    </div>
    <AgentGoalBar controller={controller}/>
    <AgentGoalDetails key={historyVersion} controller={controller} config={goalConfig ?? {supported: false, continuationEnabled: false}}
      conversationId={conversationId} open embedded/>
  </section>;
}
