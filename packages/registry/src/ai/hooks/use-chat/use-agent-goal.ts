"use client";

import { useEffect, useRef, useState } from "react";
import { useDocumentVisibility, useLatest, useMemoizedFn } from "ahooks";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useAiChatRequestSignal} from "../../agents/context";
import { useApiRequest } from "../../../api/hooks/use-api-request";
import { useAgentMessages } from "../../../i18n/runtime";
import {ApiError} from "@lingya-ai/agents-sdk/browser";

import { reconcileGoal } from "./agent-goal-policy";
import {
  AgentGoalPhase,
  AgentGoalRecordState,
  type AgentGoal,
  type EditAgentGoalInput,
} from "./agent-goal-schema";

/** 目标操作共用的防重复提交保护。 */
export class GoalActionFlight {
  private running = false;
  /** 同一时刻只允许一项控制面操作，失败后释放保护。 */
  async run<T>(
    operation: () => Promise<T>,
    duplicateMessage: string,
  ): Promise<T> {
    if (this.running) throw new Error(duplicateMessage);
    this.running = true;
    try {
      return await operation();
    } finally {
      this.running = false;
    }
  }
}

interface UseAgentGoalOptions {
  httpClient: AgentsClient;
  conversationId?: string;
  enabled: boolean;
  executionActive: boolean;
  requireAccess: () => void;
}

/** 管理会话目标快照；读请求不能覆盖其后发生的控制面写入。 */
export function useAgentGoal(options: UseAgentGoalOptions) {
  const t = useAgentMessages("use-agent-goal");
  const { httpClient, conversationId, enabled, executionActive } = options;
  const latest = useLatest(options);
  const api = httpClient.chat;
  const signal=useAiChatRequestSignal(httpClient);
  const visibility = useDocumentVisibility();
  const [goal, setGoal] = useState<AgentGoal | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [invalidated, setInvalidated] = useState(0);
  const [expiredGeneration, setExpiredGeneration] = useState(0);
  const scope = useRef({ httpClient, conversationId, enabled, generation: 0 });
  const epoch = useRef(0);
  useEffect(
    () => () => {
      scope.current = {
        ...scope.current,
        generation: scope.current.generation + 1,
      };
      epoch.current += 1;
    },
    [],
  );
  const flight = useRef(new GoalActionFlight());
  if (
    scope.current.httpClient !== httpClient ||
    scope.current.conversationId !== conversationId ||
    scope.current.enabled !== enabled
  ) {
    scope.current = {
      httpClient,
      conversationId,
      enabled,
      generation: scope.current.generation + 1,
    };
    epoch.current += 1;
  }
  const [snapshotScope, setSnapshotScope] = useState(scope.current);
  const visibleGoal = snapshotScope === scope.current ? goal : null;
  const commit = useMemoizedFn((next: AgentGoal | null) => {
    epoch.current += 1;
    setSnapshotScope(scope.current);
    setGoal((previous) =>
      reconcileGoal(snapshotScope === scope.current ? previous : null, next),
    );
    setError(null);
  });
  const fetchGoal = useMemoizedFn(async () => {
    const captured = scope.current;
    const readEpoch = epoch.current;
    if (!captured.enabled || !captured.conversationId) return;
    try {
      const next = await captured.httpClient.chat.getGoal(
        captured.conversationId,
        {signal},
      );
      if (captured === scope.current && readEpoch === epoch.current)
        commit(next.goal);
    } catch (failure) {
      if (captured === scope.current && readEpoch === epoch.current)
        setError(
          failure instanceof Error ? failure : new Error(String(failure)),
        );
      throw failure;
    }
  });
  const fast = executionActive || visibleGoal?.phase === AgentGoalPhase.Active;
  const query = useApiRequest(fetchGoal, {
    manual: true,
    pollingInterval: fast ? 3000 : 15000,
    pollingWhenHidden: false,
    pollingSilentLoading: true,
    disableErrorNotification: true,
  });
  const { run, cancel } = query;
  useEffect(() => {
    if (enabled && conversationId && visibility === "visible") run();
    else cancel();
    return cancel;
  }, [enabled, conversationId, httpClient, visibility, run, cancel]);

  const perform = useMemoizedFn(
    async (operation: () => Promise<AgentGoal>): Promise<AgentGoal> =>
      flight.current.run(async () => {
        if (!latest.current.enabled) throw new Error(t.unavailable.value);
        latest.current.requireAccess();
        const captured = scope.current;
        epoch.current += 1;
        setLoading(true);
        try {
          return await operation();
        } catch (failure) {
          if (
            captured === scope.current &&
            failure instanceof ApiError &&
            [409, 410].includes(failure.status ?? 0)
          ) {
            setInvalidated((value) => value + 1);
            if ((failure.status ?? 0) === 410)
              setExpiredGeneration((value) => value + 1);
            await fetchGoal().catch(() => {
              /* 原操作错误由表单或按钮呈现，查询错误保留在目标区域。 */
            });
          }
          throw failure;
        } finally {
          if (captured === scope.current) setLoading(false);
        }
      }, t.submitting.value),
  );
  useEffect(() => {
    setLoading(false);
    setError(null);
  }, [conversationId, httpClient, enabled]);

  const mutate = useMemoizedFn(
    (
      operation: (id: string, current: AgentGoal) => Promise<AgentGoal>,
    ): Promise<AgentGoal> =>
      perform(async (): Promise<AgentGoal> => {
        const captured = scope.current;
        const current = visibleGoal;
        if (!captured.conversationId || !current)
          throw new Error(t.notReady.value);
        const result = await operation(captured.conversationId, current);
        if (captured === scope.current) {
          commit(
            result.recordState === AgentGoalRecordState.Current ? result : null,
          );
          setInvalidated((value) => value + 1);
        }
        return result;
      }),
  );
  return {
    goal: visibleGoal,
    error,
    loading,
    invalidated,
    expiredGeneration,
    refresh: query.refreshAsync,
    api,
    signal,
    edit: (
      input: Omit<EditAgentGoalInput, "goalId" | "goalRevision">,
      ref?: Pick<AgentGoal, "goalId" | "goalRevision">,
    ) =>
      mutate((id, current) =>
        api.editGoal(id, {
          ...(ref ?? {
            goalId: current.goalId,
            goalRevision: current.goalRevision,
          }),
          ...input,
        },{signal}),
      ),
    pause: () => mutate((id, current) => api.pauseGoal(id, current,{signal})),
    resume: (ref?: Pick<AgentGoal, "goalId" | "goalRevision">) =>
      mutate((id, current) => {
        // 连续保存并启动时使用保存响应的版本，禁止跨目标恢复。
        if (ref && ref.goalId !== current.goalId)
          throw new Error(t.switched.value);
        return api.resumeGoal(id, ref ?? current,{signal});
      }),
    clear: () => mutate((id, current) => api.clearGoal(id, current,{signal})),
  };
}
export type AgentGoalController = ReturnType<typeof useAgentGoal>;
