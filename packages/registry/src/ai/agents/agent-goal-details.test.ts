// @vitest-environment jsdom
import React, { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentGoalDetails } from "./agent-goal-details";
import { goalFixture } from "../hooks/use-chat/agent-goal.test-fixtures";
import type { AgentGoalController } from "../hooks/use-chat/use-agent-goal";

vi.stubGlobal("React", React);
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () =>
    new Proxy(
      {},
      {
        get: (_, key) => ({
          ...createElement("span", null, String(key)),
          value: String(key),
        }),
      },
    ),
}));
vi.mock("./agent-goal-form", () => ({
  AgentGoalForm: ({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) =>
    createElement("div", null,
      createElement("textarea", { "aria-label": "目标编辑" }),
      createElement("button", { onClick: onCancel }, "取消编辑"),
      createElement("button", { onClick: onSuccess }, "保存编辑"),
    ),
}));
afterEach(cleanup);

const config = {
  supported: true,
  continuationEnabled: false,
};

function controller() {
  return {
    goal: null,
    loading: false,
    invalidated: 0,
    expiredGeneration: 0,
    pause: vi.fn().mockResolvedValue(goalFixture()),
    resume: vi.fn().mockResolvedValue(goalFixture()),
    clear: vi.fn().mockResolvedValue(null),
    api: {
      getGoalHistory: vi
        .fn<AgentGoalController["api"]["getGoalHistory"]>()
        .mockResolvedValue({ items: [goalFixture()], page: 0, size: 20, hasNext: false }),
    },
  } as unknown as AgentGoalController;
}

it("目标历史内嵌时读取当前会话记录，不弹出模态框；切换会话读取新记录", async () => {
  const goal = controller();
  const props = {
    controller: goal,
    config,
    embedded: true,
    historyOnly: true,
    open: true,
  };
  const view = render(
    createElement(AgentGoalDetails, {
      ...props,
      conversationId: "first",
      key: "first",
    }),
  );
  expect(await screen.findByText(/整理资料/)).toBeTruthy();
  expect(goal.api.getGoalHistory).toHaveBeenCalledWith("first",{signal:undefined});
  expect(screen.queryByText("noCurrent")).toBeNull();
  expect(screen.queryByText("requests")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  goal.api.getGoalHistory = vi
    .fn<AgentGoalController["api"]["getGoalHistory"]>()
    .mockResolvedValue({
      items: [{ ...goalFixture(), objective: "新会话目标" }],
      page: 0,
      size: 20,
      hasNext: false,
    });
  view.rerender(
    createElement(AgentGoalDetails, {
      ...props,
      conversationId: "second",
      key: "second",
    }),
  );
  expect(await screen.findByText("新会话目标")).toBeTruthy();
  expect(screen.queryByText(/整理资料/)).toBeNull();
  expect(goal.api.getGoalHistory).toHaveBeenCalledWith("second",{signal:undefined});
});

it("未打开目标历史或尚无会话时不请求，独立详情使用模态框", async () => {
  const goal = controller();
  const props = { controller: goal, config, onOpenChange: vi.fn() };
  const view = render(
    createElement(AgentGoalDetails, {
      ...props,
      open: false,
      conversationId: "first",
    }),
  );
  expect(goal.api.getGoalHistory).not.toHaveBeenCalled();
  view.rerender(
    createElement(AgentGoalDetails, { ...props, embedded: true, open: true }),
  );
  expect(goal.api.getGoalHistory).not.toHaveBeenCalled();
  view.rerender(
    createElement(AgentGoalDetails, {
      ...props,
      open: true,
      conversationId: "first",
    }),
  );
  await waitFor(() => expect(goal.api.getGoalHistory).toHaveBeenCalledWith("first",{signal:undefined}));
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("工作区目标记录显示完整受阻原因，无内容的记录不显示说明", async () => {
  const goal = controller();
  const blockedMessage = "等待补充材料\n".repeat(30);
  vi.mocked(goal.api.getGoalHistory).mockResolvedValue({
    items: [
      { ...goalFixture(), blockedMessage },
      { ...goalFixture(), goalId: "g2", blockedMessage: "   " },
    ],
    page: 0,
    size: 20,
    hasNext: false,
  });
  render(createElement(AgentGoalDetails, {
    controller: goal, config, conversationId: "first", embedded: true, historyOnly: true, open: true,
  }));
  expect(await screen.findByRole("heading", { name: "blockedReason" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { name: "blockedReason" })).toHaveLength(1);
  expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === blockedMessage)).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("模态框展示阻塞说明和禁用提示，暂停独立执行，关闭后清理编辑态", async () => {
  const goal = { ...controller(), goal: { ...goalFixture(), blockedMessage: "等待补充资料" } };
  const props = { controller: goal, config, conversationId: "first", onOpenChange: vi.fn() };
  const view = render(createElement(AgentGoalDetails, { ...props, open: true }));
  expect(screen.getByText("等待补充资料")).toBeTruthy();
  expect(screen.getByText("disabled")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "pause" }));
  await waitFor(() => expect(goal.pause).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  expect(screen.getByRole("textbox", { name: "目标编辑" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "取消编辑" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "edit" }));
  view.rerender(createElement(AgentGoalDetails, { ...props, open: false }));
  view.rerender(createElement(AgentGoalDetails, { ...props, open: true }));
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "title" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(goal.clear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "confirm" }));
  await waitFor(() => expect(goal.clear).toHaveBeenCalledTimes(1));
});
