"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  captureMessageScrollPosition,
  restoreMessageScrollPosition,
  type MessageScrollRestoreTarget,
} from "./message-scroll-anchor";
import type { AgentsChatMessageViewMode } from "./message-disclosure-policy";

export enum DisclosureScope {
  Group = "group",
  Reasoning = "reasoning",
  Tool = "tool",
  SubAgentMessages = "sub-agent-messages",
}

export interface MessageDisclosureState {
  get(
    messageId: string,
    scope: DisclosureScope,
    nodeKey?: string,
    viewMode?: AgentsChatMessageViewMode,
  ): boolean | undefined;
  set(
    messageId: string,
    scope: DisclosureScope,
    nodeKey: string,
    open: boolean,
    viewMode?: AgentsChatMessageViewMode,
  ): void;
  resetFull(messageId: string): void;
}

type DisclosureValues = Map<string, Map<string, boolean>>;

interface MessageDisclosureStore {
  scope: string;
  mode: AgentsChatMessageViewMode;
  compactValues: DisclosureValues;
  fullValues: DisclosureValues;
}

function retainVisibleMessages(
  values: DisclosureValues,
  messageIds: ReadonlySet<string>,
): DisclosureValues {
  if (Array.from(values.keys()).every((id) => messageIds.has(id)))
    return values;
  return new Map(Array.from(values).filter(([id]) => messageIds.has(id)));
}

/** 状态归属列表而非虚拟行；切换会话立即隔离，行卸载不清除用户选择。 */
export function useMessageDisclosureState(
  scope: string,
  messageIds: readonly string[],
  root: RefObject<HTMLDivElement | null>,
  viewMode: AgentsChatMessageViewMode = "compact",
): MessageDisclosureState {
  const [store, setStore] = useState<MessageDisclosureStore>(() => ({
    scope,
    mode: viewMode,
    compactValues: new Map(),
    fullValues: new Map(),
  }));
  const pendingAnchor = useRef<MessageScrollRestoreTarget | undefined>(
    undefined,
  );
  const activeScope = useRef(scope);

  useLayoutEffect(() => {
    activeScope.current = scope;
    const scopeChanged = store.scope !== scope;
    const modeChanged = store.mode !== viewMode;
    if (scopeChanged) pendingAnchor.current = undefined;
    const visibleMessages = new Set(messageIds);
    setStore((previous) => {
      if (previous.scope !== scope)
        return {
          scope,
          mode: viewMode,
          compactValues: new Map(),
          fullValues: new Map(),
        };

      const compactValues = retainVisibleMessages(
        previous.compactValues,
        visibleMessages,
      );
      // 每次从重点模式进入完整模式都重新展开；重点模式的覆盖单独保留。
      const fullValues =
        modeChanged && viewMode === "full"
          ? new Map<string, Map<string, boolean>>()
          : retainVisibleMessages(previous.fullValues, visibleMessages);
      if (
        !modeChanged &&
        compactValues === previous.compactValues &&
        fullValues === previous.fullValues
      )
        return previous;
      return {
        scope,
        mode: viewMode,
        compactValues,
        fullValues,
      };
    });
    // 只在模式切换或消息身份变化时更新；事件增量不会重置节点覆盖。
  }, [scope, messageIds, viewMode, store.scope, store.mode]);

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor || !root.current) return;
    const expectedScope = scope;
    let frame = 0;
    let finished = false;
    const restore = () => {
      if (!finished && activeScope.current === expectedScope)
        restoreMessageScrollPosition(root.current, anchor);
    };
    // measureElement 的 ResizeObserver 与动画结束都可能晚于初次提交。
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(restore);
          });
    const list = root.current.querySelector<HTMLElement>(
      "[data-chat-message-list]",
    );
    if (list) observer?.observe(list);
    frame = requestAnimationFrame(restore);
    const handleTransitionEnd = () => restore();
    list?.addEventListener("transitionend", handleTransitionEnd);
    // 有限收尾，不在后续 token/异步结果更新时持续抢滚动。
    const timeout = window.setTimeout(() => {
      restore();
      finished = true;
      observer?.disconnect();
      pendingAnchor.current = undefined;
    }, 250);
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer?.disconnect();
      list?.removeEventListener("transitionend", handleTransitionEnd);
    };
  }, [store, scope, root]);

  // 只在节点状态、会话或滚动容器变化时换引用，避免每个 token 重绘未变化的虚拟行。
  return useMemo<MessageDisclosureState>(
    () => ({
      get: (messageId, nodeScope, nodeKey = "", messageViewMode = viewMode) => {
        if (store.scope !== scope || store.mode !== viewMode) return undefined;
        const values =
          messageViewMode === "full"
            ? store.fullValues
            : store.compactValues;
        return values.get(messageId)?.get(JSON.stringify([nodeScope, nodeKey]));
      },
      set: (messageId, nodeScope, nodeKey, open, messageViewMode = viewMode) => {
        if (activeScope.current !== scope) return;
        pendingAnchor.current = captureMessageScrollPosition(root.current);
        setStore((previous) => {
          const scopeMatches = previous.scope === scope;
          const previousValues = scopeMatches
            ? messageViewMode === "full"
              ? previous.fullValues
              : previous.compactValues
            : new Map<string, Map<string, boolean>>();
          const values = new Map(previousValues);
          const nodes = new Map(values.get(messageId));
          nodes.set(JSON.stringify([nodeScope, nodeKey]), open);
          values.set(messageId, nodes);
          return {
            scope,
            mode: viewMode,
            compactValues:
              messageViewMode === "compact"
                ? values
                : scopeMatches
                  ? previous.compactValues
                  : new Map(),
            fullValues:
              messageViewMode === "full"
                ? values
                : scopeMatches
                  ? previous.fullValues
                  : new Map(),
          };
        });
      },
      resetFull: (messageId) => {
        if (activeScope.current !== scope) return;
        pendingAnchor.current = captureMessageScrollPosition(root.current);
        setStore((previous) => {
          if (previous.scope !== scope || !previous.fullValues.has(messageId))
            return previous;
          const fullValues = new Map(previous.fullValues);
          fullValues.delete(messageId);
          return { ...previous, fullValues };
        });
      },
    }),
    [store, scope, viewMode, root],
  );
}
