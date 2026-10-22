// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAsyncTask } from "../hooks/use-chat/use-agent-async-tasks";
import { AgentsChatAsyncTasks } from "./agents-chat-async-tasks";

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => ({
    title: ({ count }: { count: number }) => `异步任务（${count}）`,
    taskStatuses: { RUNNING: "执行中", FAILED: "失败" },
    notificationStatusLabel: "Agent 通知",
    notificationStatuses: { WAITING: "等待结果", FAILED: "失败" },
    trackingSuspended: "状态跟踪已暂停",
    trackingPaused: "跟踪暂停",
    notificationFailed: "通知失败",
  }),
}));

const task: AgentAsyncTask = {
  taskId: "t1",
  taskType: "TOOL", resultAvailable: false, cancellable: true,
  originConversationId: "c", originMessageId: "m", originToolId: "tool", originToolName: "工具",
  createdTime: new Date("2026-09-08T09:00:00Z"),
  title: "需要完整显示悬停提示的长任务标题",
  targetMessageId: "m1",
  status: "RUNNING",
  notificationStatus: "WAITING",
  trackingStatus: "ACTIVE",
  progressPercent: 45,
  lastUpdateTime: new Date("2026-09-08T09:00:00Z"),
};

beforeEach(() => {
  // jsdom 不提供尺寸观察器，Tooltip 的定位逻辑需要该浏览器接口。
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("异步任务贴片交互", () => {
  it("默认收纳列表但保留任务入口，展开后紧凑任务行支持聚焦通知详情", async () => {
    const { container } = render(
      createElement(AgentsChatAsyncTasks, { tasks: [task] }),
    );
    const trigger = screen.getByRole("button", { name: /^异步任务/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(task.title)).toBeNull();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(task.title)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("执行中");
    expect(screen.getByRole("status").textContent).toContain("45%");
    expect(screen.queryByText(/Agent 通知/)).toBeNull();
    fireEvent.focus(
      screen.getByRole("button", { name: new RegExp(task.title) }),
    );
    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "Agent 通知: 等待结果",
    );
    expect(
      container.querySelector<HTMLElement>('[data-slot="scroll-area"]')?.style
        .height,
    ).toBe("28px");
  });

  it("保持服务端顺序，超过两项时限制列表高度", () => {
    const tasks = [
      task,
      { ...task, taskId: "t2", title: "第二项" },
      { ...task, taskId: "t3", title: "第三项" },
    ];
    const { container } = render(
      createElement(AgentsChatAsyncTasks, { tasks }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^异步任务/ }));
    expect(
      screen.getByRole("button", { name: /^异步任务/ }).textContent,
    ).toContain("异步任务（3）");
    expect(
      screen
        .getAllByRole("listitem")
        .map((row) => row.querySelector("button > span")?.textContent),
    ).toEqual(tasks.map((item) => item.title));
    expect(
      container.querySelector<HTMLElement>('[data-slot="scroll-area"]')?.style
        .height,
    ).toBe("56px");
  });

  it("展开后失败和跟踪暂停直接显示，不依赖悬停", () => {
    render(
      createElement(AgentsChatAsyncTasks, {
        tasks: [
          {
            ...task,
            trackingStatus: "SUSPENDED",
            notificationStatus: "FAILED",
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^异步任务/ }));
    expect(screen.getByText("跟踪暂停")).toBeTruthy();
    expect(screen.getByText("通知失败")).toBeTruthy();
  });

  it("同一会话更新和列表清空保留主动展开，切换会话恢复默认收纳", () => {
    const view = render(
      createElement(AgentsChatAsyncTasks, { key: "c1", tasks: [task] }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^异步任务/ }));
    view.rerender(
      createElement(AgentsChatAsyncTasks, {
        key: "c1",
        tasks: [{ ...task, progressPercent: 60 }],
      }),
    );
    expect(
      screen
        .getByRole("button", { name: /^异步任务/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    view.rerender(
      createElement(AgentsChatAsyncTasks, { key: "c1", tasks: [] }),
    );
    expect(screen.queryByRole("button")).toBeNull();
    view.rerender(
      createElement(AgentsChatAsyncTasks, { key: "c1", tasks: [task] }),
    );
    expect(
      screen
        .getByRole("button", { name: /^异步任务/ })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    view.rerender(
      createElement(AgentsChatAsyncTasks, { key: "c2", tasks: [task] }),
    );
    expect(
      screen
        .getByRole("button", { name: /^异步任务/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
