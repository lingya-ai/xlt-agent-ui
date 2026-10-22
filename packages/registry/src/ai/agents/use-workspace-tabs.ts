"use client";

import { useEffect, useState } from "react";
import {
  closeWorkspacePage,
  createWorkspaceTabsState,
  openWorkspacePage,
  WorkspacePageKind,
  type WorkspacePage,
  type WorkspaceTabsState,
} from "./workspace-tabs-state";

/** 会话内共享的标签生命周期，能力撤回时移除对应页面。 */
export function useWorkspaceTabs(
  conversationId: string | undefined,
  subagentsAvailable: boolean,
  goalAvailable: boolean,
) {
  const [scope, setScope] = useState<{
    conversationId?: string;
    state: WorkspaceTabsState;
  }>({ conversationId, state: createWorkspaceTabsState() });
  const state =
    scope.conversationId === conversationId
      ? scope.state
      : createWorkspaceTabsState();
  const updateTabs = (
    update: (state: WorkspaceTabsState) => WorkspaceTabsState,
  ) => {
    setScope((current) => ({
      conversationId,
      state: update(
        current.conversationId === conversationId
          ? current.state
          : createWorkspaceTabsState(),
      ),
    }));
  };
  useEffect(() => {
    setScope((current) => {
      if (current.conversationId !== conversationId)
        return { conversationId, state: createWorkspaceTabsState() };
      const unavailable = current.state.tabs.filter(
        (page) =>
          (!subagentsAvailable &&
            (page.kind === WorkspacePageKind.Subagents ||
              page.kind === WorkspacePageKind.SubagentDetail)) ||
          (!goalAvailable && page.kind === WorkspacePageKind.GoalHistory),
      );
      if (!unavailable.length) return current;
      return {
        ...current,
        state: unavailable.reduce(
          (next, page) => closeWorkspacePage(next, page.key),
          current.state,
        ),
      };
    });
  }, [conversationId, subagentsAvailable, goalAvailable]);
  return {
    ...state,
    updateTabs,
    openTab: (page: WorkspacePage) =>
      updateTabs((current) => openWorkspacePage(current, page)),
    activateTab: (key: string) =>
      updateTabs((current) =>
        current.tabs.some((page) => page.key === key)
          ? { ...current, activeTabKey: key }
          : current,
      ),
    closeTab: (key: string) =>
      updateTabs((current) => closeWorkspacePage(current, key)),
  };
}
