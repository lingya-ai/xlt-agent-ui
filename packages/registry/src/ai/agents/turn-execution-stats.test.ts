// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import type { ChatItem } from "../hooks/use-chat/types";
import type { TokenUsage } from "../lib/token-usage";
import { TokenUsageDetails } from "./token-usage-details";
import { TurnExecutionStats } from "./turn-execution-stats";

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: (key: string) => {
    if (key === "turn-execution-stats") {
      return {
        roundSteps: ({ rounds, steps }: { rounds: number | string; steps: number | string }) => `${rounds}次${steps}步`,
        cacheHit: ({ rate }: { rate: string }) => `缓存命中${rate}`,
      };
    }
    if (key === "token-usage-details") {
      return {
        inputTokens: "输入 Token",
        reasoningTokens: "推理 Token",
        outputTokens: "输出 Token",
        totalTokens: "总 Token",
        uncachedInputTokens: "普通输入",
        cachedInputTokens: "缓存输入",
        cacheCreationInputTokens: "缓存创建输入",
        cacheHitRate: "缓存命中率",
        unavailable: "-",
        compactAriaLabel: { value: "查看 Token 用量详情" },
      };
    }
    throw new Error(`测试缺少独立字典 mock: ${key}`);
  },
}));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const item: ChatItem = {
  id: "turn-1",
  loaded: true,
  loading: false,
  status: ConversationMessageStatus.COMPLETED,
  assistant: [],
  executionTimeMillis: 3000,
  processingSteps: 1,
  totalToolCalls: 0,
};

const usage: TokenUsage = {
  inputTokens: 13700,
  outputTokens: 95,
  totalTokens: 13795,
  reasoningTokens: null,
  inputTokenBreakdown: {
    observedInputTokens: 13700,
    uncachedInputTokens: 180,
    cachedInputTokens: 13520,
    cacheCreationInputTokens: null,
  },
  cacheHitRate: 13520 / 13700,
  inputBreakdownCoverageRate: 1,
};

describe("每轮统计", () => {
  it("使用点分隔统计，Token 触发器保留完整的八项悬浮详情", async () => {
    const view = render(createElement(TurnExecutionStats, { item, usage }));
    expect(view.container.textContent).toBe("3s · 1次0步 · 13.8k · 缓存命中98.7%");
    const trigger = screen.getByRole("button", { name: "查看 Token 用量详情" });
    expect(trigger.querySelector("svg")).toBeNull();
    expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();
    const hoverEvent = new MouseEvent("pointermove", { bubbles: true });
    Object.defineProperty(hoverEvent, "pointerType", { value: "mouse" });
    fireEvent(trigger, hoverEvent);
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull());
    const panel = document.querySelector('[data-slot="tooltip-content"]');
    expect(panel?.classList.contains("bg-popover")).toBe(true);
    expect(panel?.classList.contains("text-popover-foreground")).toBe(true);
    const metrics = Array.from(panel?.querySelectorAll(".min-w-0") ?? []).slice(0, 8);
    expect(metrics.map(metric => Array.from(metric.querySelectorAll("p")).map(p => p.textContent))).toEqual([
      ["输入 Token", "13.7K"],
      ["推理 Token", "-"],
      ["输出 Token", "95"],
      ["总 Token", "13.8K"],
      ["普通输入", "180"],
      ["缓存输入", "13.5K"],
      ["缓存创建输入", "-"],
      ["缓存命中率", "98.7%"],
    ]);
  });

  it.each([
    { processingSteps: undefined, totalToolCalls: 0, label: "—次0步" },
    { processingSteps: 1, totalToolCalls: undefined, label: "1次—步" },
    { processingSteps: 0, totalToolCalls: 0, label: "0次0步" },
  ])("区分缺失计数和真实零值：$label", ({ label, ...counts }) => {
    const view = render(createElement(TurnExecutionStats, { item: { ...item, ...counts } }));
    expect(view.container.textContent).toBe(`3s · ${label}`);
  });

  it.each([
    { messageStatsPending: true },
    { loading: true },
    { status: ConversationMessageStatus.PENDING },
  ])("统计尚未结算时仅使用 End 的耗时和用量：%j", state => {
    const view = render(createElement(TurnExecutionStats, {
      item: { ...item, ...state }, endDuration: 6000, usage,
    }));
    expect(view.container.textContent).toBe("6s · 13.8k · 缓存命中98.7%");
  });

  it("两个计数均缺失时隐藏次数和步数项，不留下多余分隔符", () => {
    const view = render(createElement(TurnExecutionStats, {
      item: { ...item, processingSteps: undefined, totalToolCalls: undefined }, usage,
    }));
    expect(view.container.textContent).toBe("3s · 13.8k · 缓存命中98.7%");
  });

  it("计数补全时保留 Token 触发器和已打开的悬浮面板", async () => {
    const view = render(createElement(TurnExecutionStats, {
      item: { ...item, messageStatsPending: true }, endDuration: 3000, usage,
    }));
    const trigger = screen.getByRole("button", { name: "查看 Token 用量详情" });
    const hoverEvent = new MouseEvent("pointermove", { bubbles: true });
    Object.defineProperty(hoverEvent, "pointerType", { value: "mouse" });
    fireEvent(trigger, hoverEvent);
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull());
    view.rerender(createElement(TurnExecutionStats, { item, endDuration: 3000, usage }));
    expect(screen.getByRole("button", { name: "查看 Token 用量详情" })).toBe(trigger);
    expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull();
    expect(view.container.textContent).toBe("3s · 1次0步 · 13.8k · 缓存命中98.7%");
  });

  it("仅有用量时不显示前导分隔符，缺失缓存率不伪装成零", () => {
    const view = render(createElement(TurnExecutionStats, {
      item: { ...item, executionTimeMillis: undefined, processingSteps: undefined, totalToolCalls: undefined },
      usage: { ...usage, inputTokenBreakdown: null, cacheHitRate: null },
    }));
    expect(view.container.textContent).toBe("13.8k · 缓存命中—");
  });

  it("结束事件仅提供缓存分项时，统计栏和详情均计算命中率", () => {
    const eventUsage = {
      inputTokens: 51060, outputTokens: 7, totalTokens: 51067,
      inputTokenBreakdown: {observedInputTokens: 51060, uncachedInputTokens: 42612, cachedInputTokens: 8448},
    } as TokenUsage;
    const view = render(createElement(TurnExecutionStats, {item, usage: eventUsage}));
    expect(view.container.textContent).toContain("缓存命中16.5%");
    view.rerender(createElement(TokenUsageDetails, {usage: eventUsage}));
    expect(screen.getByText("16.5%")).toBeTruthy();
    expect(screen.getByText("8.4K")).toBeTruthy();
  });

  it("总 Token 和缓存命中率为零时正常展示", () => {
    const view = render(createElement(TurnExecutionStats, {
      item,
      usage: { ...usage, inputTokens: 0, outputTokens: 0, totalTokens: 0, inputTokenBreakdown: null, cacheHitRate: 0 },
    }));
    expect(view.container.textContent).toBe("3s · 1次0步 · 0.0k · 缓存命中0%");
  });

  it.each([95, 1000, 1000000])("Token 总量 %i 固定一位小数且始终使用小写 k", totalTokens => {
    render(createElement(TurnExecutionStats, { item, usage: { ...usage, totalTokens } }));
    expect(screen.getByRole("button", { name: "查看 Token 用量详情" }).textContent)
      .toBe(`${(totalTokens / 1000).toFixed(1)}k`);
  });

  it("没有可靠统计和用量时不生成空统计行", () => {
    const view = render(createElement(TurnExecutionStats, { item: { ...item, messageStatsPending: true } }));
    expect(view.container.childElementCount).toBe(0);
  });

  it("其他紧凑用量触发器继续显示图标和原有格式", () => {
    render(createElement(TokenUsageDetails, { usage, variant: "compact" }));
    const trigger = screen.getByRole("button", { name: "查看 Token 用量详情" });
    expect(trigger.textContent).toBe("13.8K");
    expect(trigger.querySelector("svg")).not.toBeNull();
  });
});
