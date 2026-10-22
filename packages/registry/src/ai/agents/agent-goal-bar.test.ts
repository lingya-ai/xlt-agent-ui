// @vitest-environment jsdom
import React, { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentGoalBar } from "./agent-goal-bar";
import { AgentGoalPhase } from "../hooks/use-chat/agent-goal-schema";
import { goalFixture } from "../hooks/use-chat/agent-goal.test-fixtures";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";

vi.stubGlobal("React", React);
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => new Proxy({}, {
    get: (_, key) => key === "characterCount"
      ? ({ count }: { count: number }) => createElement("span", null, `${count} / 4000`)
      : ({ ...createElement("span", null, String(key)), value: String(key) }),
  }),
}));
afterEach(cleanup);

function controller(): AgentGoalController {
  return {
    goal: { ...goalFixture(), objective: "很长的目标".repeat(100), blockedMessage: "详细阻塞原因" },
    loading: false,
    invalidated: 0,
    expiredGeneration: 0,
    pause: vi.fn().mockResolvedValue(goalFixture()),
    resume: vi.fn().mockResolvedValue(goalFixture()),
    clear: vi.fn().mockResolvedValue(null),
    edit: vi.fn().mockResolvedValue(goalFixture()),
    api: { getGoalHistory: vi.fn().mockResolvedValue({ items: [], page: 0, size: 20, hasNext: false }) },
  } as unknown as AgentGoalController;
}


it("状态在摘要前，右侧只保留编辑与执行按钮，摘要不再打开详情", () => {
  const goal = controller();
  const view = render(createElement(AgentGoalBar, { controller: goal }));
  const bar = view.container.querySelector("[data-goal-bar]");
  expect(bar?.classList.contains("h-8")).toBe(true);
  const summary = screen.getByText(goal.goal?.objective ?? "");
  expect(summary.getAttribute("title")).toBe(goal.goal?.objective);
  expect(bar?.firstElementChild?.textContent).toBe("armed");
  expect(screen.getAllByRole("button")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "details" })).toBeNull();
  fireEvent.click(summary);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(goal.api.getGoalHistory).not.toHaveBeenCalled();
});

it("暂停和恢复独立执行，不打开编辑框；请求中禁止重复操作", async () => {
  const goal = controller();
  const view = render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "pause" }));
  await waitFor(() => expect(goal.pause).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("dialog")).toBeNull();
  const paused = { ...goal, goal: { ...goalFixture(), phase: AgentGoalPhase.Paused, effectivelyArmed: false } };
  view.rerender(createElement(AgentGoalBar, { controller: paused }));
  fireEvent.click(screen.getByRole("button", { name: "resume" }));
  await waitFor(() => expect(goal.resume).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(createElement(AgentGoalBar, { controller: { ...paused, loading: true } }));
  expect(screen.getByRole("button", { name: "resume" }).hasAttribute("disabled")).toBe(true);
});

it("没有目标或目标完成后隐藏入口", () => {
  const goal = controller();
  const props = {};
  const view = render(createElement(AgentGoalBar, { ...props, controller: { ...goal, goal: null } }));
  expect(view.container.querySelector("[data-goal-bar]")).toBeNull();
  view.rerender(createElement(AgentGoalBar, {
    ...props,
    controller: { ...goal, goal: { ...goalFixture(), phase: AgentGoalPhase.Complete } },
  }));
  expect(view.container.querySelector("[data-goal-bar]")).toBeNull();
});

it("编辑直接打开表单，不查询历史；取消和 Escape 关闭后恢复编辑按钮焦点", async () => {
  const goal = controller();
  render(createElement(AgentGoalBar, { controller: goal }));
  const edit = screen.getByRole("button", { name: "edit" });
  fireEvent.click(edit);
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(screen.getByRole("textbox")).toBeTruthy();
  expect(screen.queryByText("详细阻塞原因")).toBeNull();
  expect(screen.queryByText("disabled")).toBeNull();
  expect(screen.getByRole("button", { name: "title" }).textContent).toBe("title");
  expect(goal.api.getGoalHistory).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "未保存的内容" } });
  fireEvent.click(screen.getByRole("button", { name: "cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(edit));
  fireEvent.click(edit);
  expect(screen.getByRole("textbox").getAttribute("name")).toBe("objective");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(goal.goal?.objective);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(edit));
});

it("编辑提交保留打开时的目标版本，保存后关闭弹窗", async () => {
  const goal = controller();
  const view = render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  view.rerender(createElement(AgentGoalBar, {
    controller: { ...goal, goal: { ...goalFixture(), goalRevision: 2 } },
  }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "更新后的目标" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(goal.edit).toHaveBeenCalledWith(
    { objective: "更新后的目标" }, { goalId: "g1", goalRevision: 1 },
  ));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("目标过期时关闭编辑框；清除操作仍需确认", async () => {
  const goal = controller();
  const view = render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  view.rerender(createElement(AgentGoalBar, {
    controller: { ...goal, expiredGeneration: 1 },
  }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  fireEvent.click(screen.getByRole("button", { name: "title" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(goal.clear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() => expect(goal.clear).toHaveBeenCalledTimes(1));
});

it("编辑字数实时更新，空白和超限不提交，保存不会恢复或执行目标", async () => {
  const goal = controller();
  render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  const input = screen.getByRole("textbox");
  expect(input.getAttribute("maxlength")).toBe("4000");
  fireEvent.change(input, { target: { value: "目标内容" } });
  expect(screen.getByText("4 / 4000")).toBeTruthy();
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("objectiveRequired")).toBeTruthy();
  expect(goal.edit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "字".repeat(4001) } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  expect(await screen.findByText("objectiveTooLong")).toBeTruthy();
  expect(goal.edit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "字".repeat(4000) } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(goal.edit).toHaveBeenCalledTimes(1));
  expect(goal.resume).not.toHaveBeenCalled();
  expect(goal.pause).not.toHaveBeenCalled();
});

it("保存失败保留草稿，重新提交成功后关闭", async () => {
  const goal = controller();
  vi.mocked(goal.edit).mockRejectedValueOnce(new Error("保存失败"));
  render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "待保存的草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(goal.edit).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "save" }).hasAttribute("disabled")).toBe(false));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("待保存的草稿");
  fireEvent.click(screen.getByRole("button", { name: "save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(goal.edit).toHaveBeenCalledTimes(2);
});

it("提交期间禁止重复保存、清除和关闭，完成后恢复焦点", async () => {
  const goal = controller();
  let resolve: ((value: ReturnType<typeof goalFixture>) => void) | undefined;
  const pending = new Promise<ReturnType<typeof goalFixture>>((complete) => { resolve = complete; });
  vi.mocked(goal.edit).mockReturnValue(pending);
  render(createElement(AgentGoalBar, { controller: goal }));
  const edit = screen.getByRole("button", { name: "edit" });
  fireEvent.click(edit);
  const form = screen.getByRole("textbox").closest("form");
  if (!form) throw new Error("目标表单未挂载");
  fireEvent.submit(form);
  await waitFor(() => expect(goal.edit).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "saving" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "cancel" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "title" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.submit(form);
  expect(goal.edit).toHaveBeenCalledTimes(1);
  await act(async () => { resolve?.(goalFixture()); });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(edit));
});

it("保存并启动位于保存右侧，保存成功后才使用返回的新版本启动", async () => {
  const goal = controller();
  const saved = { ...goalFixture(), goalRevision: 2 };
  let finishSave: ((value: ReturnType<typeof goalFixture>) => void) | undefined;
  const pending = new Promise<ReturnType<typeof goalFixture>>((resolve) => { finishSave = resolve; });
  vi.mocked(goal.edit).mockReturnValue(pending);
  render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  const save = screen.getByRole("button", { name: "save" });
  const saveAndStart = screen.getByRole("button", { name: "saveAndStart" });
  expect(save.nextElementSibling).toBe(saveAndStart);
  fireEvent.click(saveAndStart);
  await waitFor(() => expect(goal.edit).toHaveBeenCalledTimes(1));
  expect(goal.resume).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "savingAndStarting" }).hasAttribute("disabled")).toBe(true);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeTruthy();
  await act(async () => { finishSave?.(saved); });
  await waitFor(() => expect(goal.resume).toHaveBeenCalledWith(saved));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("保存并启动仍校验输入，保存失败不启动并保留草稿", async () => {
  const goal = controller();
  vi.mocked(goal.edit).mockRejectedValueOnce(new Error("保存失败"));
  render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "saveAndStart" }));
  expect(await screen.findByText("objectiveRequired")).toBeTruthy();
  expect(goal.edit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "待启动目标" } });
  fireEvent.click(screen.getByRole("button", { name: "saveAndStart" }));
  await waitFor(() => expect(goal.edit).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "saveAndStart" }).hasAttribute("disabled")).toBe(false));
  expect(goal.resume).not.toHaveBeenCalled();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("待启动目标");
});

it("启动失败保留弹窗，再次提交使用已保存的新版本", async () => {
  const goal = controller();
  const saved = { ...goalFixture(), goalRevision: 2 };
  vi.mocked(goal.edit).mockResolvedValue(saved);
  vi.mocked(goal.resume).mockRejectedValueOnce(new Error("启动失败"));
  render(createElement(AgentGoalBar, { controller: goal }));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "目标内容" } });
  fireEvent.click(screen.getByRole("button", { name: "saveAndStart" }));
  await waitFor(() => expect(goal.resume).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "saveAndStart" }).hasAttribute("disabled")).toBe(false));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("目标内容");
  fireEvent.click(screen.getByRole("button", { name: "saveAndStart" }));
  await waitFor(() => expect(goal.edit).toHaveBeenLastCalledWith(
    { objective: "目标内容" }, { goalId: "g1", goalRevision: 2 },
  ));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(goal.resume).toHaveBeenCalledTimes(2);
});
