// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useWorkspaceTabs } from "./use-workspace-tabs";
import { WorkspacePageKind } from "./workspace-tabs-state";

afterEach(cleanup);
describe("工作区标签生命周期", () => {
  it("切换会话不恢复先前会话的标签", () => {
    const view = renderHook(
      ({ conversationId }) => useWorkspaceTabs(conversationId, true, true),
      { initialProps: { conversationId: "first" } },
    );
    act(() =>
      view.result.current.openTab({
        key: "artifacts",
        kind: WorkspacePageKind.Artifacts,
      }),
    );
    view.rerender({ conversationId: "second" });
    expect(view.result.current.activeTabKey).toBe("home");
    view.rerender({ conversationId: "first" });
    expect(view.result.current.tabs).toHaveLength(1);
  });
  it("能力失效关闭对应栏目及任务详情，不影响文件标签", () => {
    const view = renderHook(
      ({ subagents, goal }) => useWorkspaceTabs("first", subagents, goal),
      { initialProps: { subagents: true, goal: true } },
    );
    act(() => {
      view.result.current.openTab({
        key: "file:1",
        kind: WorkspacePageKind.File,
        file: { fileId: 1 },
        refreshToken: 0,
      });
      view.result.current.openTab({
        key: "subagents",
        kind: WorkspacePageKind.Subagents,
      });
      view.result.current.openTab({
        key: "subagent:one",
        kind: WorkspacePageKind.SubagentDetail,
        taskId: "one",
      });
      view.result.current.openTab({
        key: "goal-history",
        kind: WorkspacePageKind.GoalHistory,
      });
    });
    view.rerender({ subagents: false, goal: false });
    expect(view.result.current.tabs.map((page) => page.key)).toEqual([
      "home",
      "file:1",
    ]);
    expect(view.result.current.activeTabKey).toBe("file:1");
  });
});
