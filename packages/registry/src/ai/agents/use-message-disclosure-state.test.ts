// @vitest-environment jsdom
import { createElement, useEffect, useRef } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentsChatMessageViewMode } from "./message-disclosure-policy";
import {
  DisclosureScope,
  useMessageDisclosureState,
} from "./use-message-disclosure-state";

afterEach(cleanup);

function useStore(scope: string, ids: readonly string[]) {
  const root = useRef<HTMLDivElement>(null);
  return useMessageDisclosureState(scope, ids, root);
}

// 模拟状态所有者在列表层，而虚拟行可以卸载或被模式props更新。
function Row({
  open,
  onToggle,
  onMount,
}: {
  open: boolean;
  onToggle: () => void;
  onMount: () => void;
}) {
  useEffect(onMount, [onMount]);
  return createElement("button", { onClick: onToggle }, open ? "打开" : "收纳");
}
function Owner({
  scope,
  mode,
  visible,
  onMount,
}: {
  scope: string;
  mode: AgentsChatMessageViewMode;
  visible: boolean;
  onMount: () => void;
}) {
  const store = useStore(scope, ["message"]);
  const open = store.get("message", DisclosureScope.Group) ?? false;
  return createElement(
    "section",
    { "data-mode": mode },
    visible
      ? createElement(Row, {
          open,
          onMount,
          onToggle: () =>
            store.set("message", DisclosureScope.Group, "", !open),
        })
      : null,
  );
}

describe("列表级消息披露状态", () => {
  it("虚拟行卸载再挂载保留显式选择，模式props变化不重挂载行", () => {
    const onMount = vi.fn();
    const view = render(
      createElement(Owner, {
        scope: "conversation-1",
        mode: "compact",
        visible: true,
        onMount,
      }),
    );
    fireEvent.click(view.getByRole("button"));
    expect(view.getByRole("button").textContent).toBe("打开");
    expect(onMount).toHaveBeenCalledTimes(1);
    view.rerender(
      createElement(Owner, {
        scope: "conversation-1",
        mode: "full",
        visible: true,
        onMount,
      }),
    );
    expect(view.getByRole("button").textContent).toBe("打开");
    expect(onMount).toHaveBeenCalledTimes(1);
    view.rerender(
      createElement(Owner, {
        scope: "conversation-1",
        mode: "compact",
        visible: false,
        onMount,
      }),
    );
    expect(view.queryByRole("button")).toBeNull();
    view.rerender(
      createElement(Owner, {
        scope: "conversation-1",
        mode: "compact",
        visible: true,
        onMount,
      }),
    );
    expect(view.getByRole("button").textContent).toBe("打开");
    expect(onMount).toHaveBeenCalledTimes(2);
  });

  it("四种披露scope与不同nodeKey分别保存，子Agent内层与外层工具不互相覆盖", () => {
    const hook = renderHook(() => useStore("conversation", ["m1", "m2"]));
    act(() => {
      hook.result.current.set("m1", DisclosureScope.Group, "", true);
      hook.result.current.set("m1", DisclosureScope.Group, "group", false);
      hook.result.current.set(
        "m1",
        DisclosureScope.Reasoning,
        "reasoning",
        true,
      );
      hook.result.current.set("m1", DisclosureScope.Tool, "tool-1", false);
      hook.result.current.set("m1", DisclosureScope.Tool, "tool-2", true);
      hook.result.current.set(
        "m1",
        DisclosureScope.SubAgentMessages,
        "tool-1",
        true,
      );
      hook.result.current.set(
        "m1",
        DisclosureScope.SubAgentMessages,
        "tool-2",
        false,
      );
      hook.result.current.set("m2", DisclosureScope.Group, "", false);
    });
    expect(hook.result.current.get("m1", DisclosureScope.Group)).toBe(true);
    expect(hook.result.current.get("m1", DisclosureScope.Group, "group")).toBe(
      false,
    );
    expect(
      hook.result.current.get("m1", DisclosureScope.Reasoning, "reasoning"),
    ).toBe(true);
    expect(hook.result.current.get("m1", DisclosureScope.Tool, "tool-1")).toBe(
      false,
    );
    expect(hook.result.current.get("m1", DisclosureScope.Tool, "tool-2")).toBe(
      true,
    );
    expect(
      hook.result.current.get("m1", DisclosureScope.SubAgentMessages, "tool-1"),
    ).toBe(true);
    expect(
      hook.result.current.get("m1", DisclosureScope.SubAgentMessages, "tool-2"),
    ).toBe(false);
    expect(hook.result.current.get("m2", DisclosureScope.Group)).toBe(false);
    expect(
      hook.result.current.get("m2", DisclosureScope.Tool, "tool-1"),
    ).toBeUndefined();
  });

  it("会话scope切换立即隔离，即使messageId相同也不恢复旧scope覆盖", () => {
    const hook = renderHook(({ scope }) => useStore(scope, ["same-id"]), {
      initialProps: { scope: "a" },
    });
    act(() =>
      hook.result.current.set("same-id", DisclosureScope.Group, "", true),
    );
    hook.rerender({ scope: "b" });
    expect(
      hook.result.current.get("same-id", DisclosureScope.Group),
    ).toBeUndefined();
    act(() =>
      hook.result.current.set("same-id", DisclosureScope.Group, "", false),
    );
    hook.rerender({ scope: "a" });
    expect(
      hook.result.current.get("same-id", DisclosureScope.Group),
    ).toBeUndefined();
  });

  it("旧scope的延迟回调不能清空或污染当前scope状态", () => {
    const hook = renderHook(({ scope }) => useStore(scope, ["same-id"]), {
      initialProps: { scope: "a" },
    });
    const previousApi = hook.result.current;
    const staleSet = previousApi.set;
    hook.rerender({ scope: "b" });
    expect(hook.result.current).not.toBe(previousApi);
    act(() =>
      hook.result.current.set("same-id", DisclosureScope.Group, "", false),
    );
    act(() => staleSet("same-id", DisclosureScope.Group, "", true));
    expect(hook.result.current.get("same-id", DisclosureScope.Group)).toBe(
      false,
    );
  });

  it("消息从列表移除后prune覆盖，重新加入不会携带旧选择，其它消息仍保留", () => {
    const hook = renderHook(({ ids }) => useStore("conversation", ids), {
      initialProps: { ids: ["m1", "m2"] },
    });
    act(() => {
      hook.result.current.set("m1", DisclosureScope.Group, "group", true);
      hook.result.current.set("m2", DisclosureScope.Group, "", false);
    });
    hook.rerender({ ids: ["m2"] });
    expect(
      hook.result.current.get("m1", DisclosureScope.Group, "group"),
    ).toBeUndefined();
    expect(hook.result.current.get("m2", DisclosureScope.Group)).toBe(false);
    hook.rerender({ ids: ["m1", "m2"] });
    expect(
      hook.result.current.get("m1", DisclosureScope.Group, "group"),
    ).toBeUndefined();
    expect(hook.result.current.get("m2", DisclosureScope.Group)).toBe(false);
  });

  it("RootRef稳定时同值ids新数组保留API引用，节点状态改变才更新API", () => {
    const hook = renderHook(({ ids }) => useStore("conversation", ids), {
      initialProps: { ids: ["m1"] },
    });
    const previousApi = hook.result.current;
    hook.rerender({ ids: ["m1"] });
    expect(hook.result.current).toBe(previousApi);
    act(() =>
      hook.result.current.set("m1", DisclosureScope.Tool, "tool", true),
    );
    expect(hook.result.current).not.toBe(previousApi);
    expect(hook.result.current.get("m1", DisclosureScope.Tool, "tool")).toBe(
      true,
    );
    const changedApi = hook.result.current;
    hook.rerender({ ids: ["m1"] });
    expect(hook.result.current).toBe(changedApi);
  });

  it("同一消息列表的新数组引用以及token刷新不清理状态", () => {
    const hook = renderHook(
      ({ ids, token }) => {
        const store = useStore("conversation", ids);
        return { store, token };
      },
      { initialProps: { ids: ["m1"], token: 1 } },
    );
    act(() =>
      hook.result.current.store.set("m1", DisclosureScope.Tool, "tool", true),
    );
    hook.rerender({ ids: ["m1"], token: 2 });
    expect(
      hook.result.current.store.get("m1", DisclosureScope.Tool, "tool"),
    ).toBe(true);
  });
});
