import { describe, expect, it } from "vitest";
import {
  createWorkspaceTabsState,
  openWorkspacePage,
  closeWorkspacePage,
  updateWorkspaceNonFilePages,
  WorkspacePageKind,
  type WorkspacePage,
} from "./workspace-tabs-state";
import { WorkspaceNonFileArtifactKindEnum } from "../hooks/use-chat/workspace-non-file-artifact-schema";

const file = (fileId: number): WorkspacePage => ({
  key: `file:${fileId}`,
  kind: WorkspacePageKind.File,
  file: { fileId, relativePath: "reports/result.pdf" },
  refreshToken: 0,
});
const page = (
  kind:
    | WorkspacePageKind.Artifacts
    | WorkspacePageKind.Subagents
    | WorkspacePageKind.GoalHistory,
): WorkspacePage => ({ key: kind, kind });

describe("工作区标签状态", () => {
  it("固定入口重复打开只聚焦，并保留排列顺序", () => {
    let state = openWorkspacePage(
      createWorkspaceTabsState(),
      page(WorkspacePageKind.Artifacts),
    );
    state = openWorkspacePage(state, file(1));
    state = openWorkspacePage(state, page(WorkspacePageKind.Artifacts));
    expect(state.tabs.map((item) => item.key)).toEqual([
      "home",
      "artifacts",
      "file:1",
    ]);
    expect(state.activeTabKey).toBe("artifacts");
  });
  it("不同来源的同一文件版本合并，路径相同的不同版本保留", () => {
    let state = openWorkspacePage(createWorkspaceTabsState(), file(1));
    state = openWorkspacePage(state, {
      key: "file:1",
      kind: WorkspacePageKind.File,
      file: { fileId: 1, conversationId: "child", fileName: "result.pdf" },
      refreshToken: 8,
    });
    expect(state.tabs).toHaveLength(2);
    expect(state.tabs[1]).toMatchObject({
      refreshToken: 0,
      file: {
        fileId: 1,
        relativePath: "reports/result.pdf",
        conversationId: "child",
        fileName: "result.pdf",
      },
    });
    state = openWorkspacePage(state, file(2));
    expect(state.tabs).toHaveLength(3);
  });
  it("关闭活动标签选择右邻、左邻，开始页不能关闭", () => {
    let state = openWorkspacePage(
      openWorkspacePage(createWorkspaceTabsState(), file(1)),
      file(2),
    );
    state = { ...state, activeTabKey: "file:1" };
    state = closeWorkspacePage(state, "file:1");
    expect(state.activeTabKey).toBe("file:2");
    state = closeWorkspacePage(state, "file:2");
    expect(state.activeTabKey).toBe("home");
    expect(closeWorkspacePage(state, "home")).toBe(state);
  });
  it("关闭非活动标签不改变焦点，不同任务独立保留", () => {
    let state = openWorkspacePage(createWorkspaceTabsState(), {
      key: "subagent:first",
      kind: WorkspacePageKind.SubagentDetail,
      taskId: "first",
    });
    state = openWorkspacePage(state, {
      key: "subagent:second",
      kind: WorkspacePageKind.SubagentDetail,
      taskId: "second",
    });
    state = closeWorkspacePage(state, "subagent:first");
    expect(state.activeTabKey).toBe("subagent:second");
    expect(state.tabs).toHaveLength(2);
  });
  it("非文件制品只按 ID 更新，迟到的旧数据不覆盖，关闭后不再打开", () => {
    const artifact = {
      artifactId: 1,
      kind: WorkspaceNonFileArtifactKindEnum.HTML_PAGE,
      title: "页面",
      description: "",
      previewUrl: "https://example.com",
      lastUpdateTime: new Date("2026-10-01T00:00:00Z"),
    };
    let state = openWorkspacePage(createWorkspaceTabsState(), {
      key: "non-file:HTML_PAGE:1",
      kind: WorkspacePageKind.NonFileArtifact,
      artifact,
      refreshToken: 0,
    });
    state = { ...state, activeTabKey: "home" };
    state = updateWorkspaceNonFilePages(state, [
      { ...artifact, title: "新页面", lastUpdateTime: new Date("2026-10-02T00:00:00Z") },
    ]);
    state = updateWorkspaceNonFilePages(state, [artifact]);
    expect(state.tabs[1]).toMatchObject({
      artifact: { title: "新页面" },
      refreshToken: 1,
    });
    expect(state.activeTabKey).toBe("home");
    state = closeWorkspacePage(state, "non-file:HTML_PAGE:1");
    expect(updateWorkspaceNonFilePages(state, [artifact]).tabs).toHaveLength(1);
  });
});
