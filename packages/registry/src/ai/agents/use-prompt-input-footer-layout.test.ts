// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROMPT_INPUT_FOOTER_RESTORE_HYSTERESIS_PX,
  PromptInputFooterLayoutMode,
  resolvePromptInputFooterLayout,
  shouldProbePromptInputFooterAfterContentChange,
  shouldProbePromptInputFooterAfterResize,
  usePromptInputFooterLayout,
} from "./use-prompt-input-footer-layout";

describe("底部工具区实际尺寸响应", () => {
  const metrics = { available: 320, expanded: 300, collapsed: 140 };
  const observers = new Set<TestResizeObserver>();
  class TestResizeObserver implements ResizeObserver {
    readonly targets = new Set<Element>();
    constructor(private readonly callback: ResizeObserverCallback) {
      observers.add(this);
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      observers.delete(this);
    }
    notify() {
      this.callback([], this);
    }
  }
  function notifyResize(target: Element) {
    act(() => {
      for (const observer of [...observers]) {
        if (observer.targets.has(target)) observer.notify();
      }
    });
  }
  function Footer({ actions = "发送" }: { actions?: string }) {
    const { footerRef, toolsRef, showToolLabels } =
      usePromptInputFooterLayout();
    return createElement(
      "div",
      { ref: footerRef, "data-testid": "footer" },
      createElement(
        "div",
        { ref: toolsRef, "data-testid": "tools" },
        createElement(
          "div",
          { "data-testid": "leading" },
          createElement(
            "button",
            { "aria-label": "附件" },
            showToolLabels ? "附件" : null,
          ),
          createElement(
            "button",
            { "aria-label": "工作区" },
            showToolLabels ? "工作区" : null,
          ),
        ),
        createElement("div", { "data-testid": "actions" }, actions),
      ),
    );
  }
  const hasLabels = () =>
    Boolean(screen.getByRole("button", { name: "附件" }).textContent);
  beforeEach(() => {
    metrics.available = 320;
    metrics.expanded = 300;
    metrics.collapsed = 140;
    observers.clear();
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.testid === "footer" ||
          this.dataset.testid === "tools"
          ? metrics.available
          : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset.testid !== "tools") return 0;
        const needed = this.textContent?.includes("附件")
          ? metrics.expanded
          : metrics.collapsed;
        return Math.max(metrics.available, needed);
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("实际内容能容纳时保留文字，缩窄后收起，宽度恢复后重新显示", async () => {
    render(createElement(Footer));
    expect(hasLabels()).toBe(true);
    metrics.available = 250;
    notifyResize(screen.getByTestId("footer"));
    await waitFor(() => expect(hasLabels()).toBe(false));
    expect(screen.getByText("发送")).toBeTruthy();
    metrics.available = 330;
    notifyResize(screen.getByTestId("footer"));
    await waitFor(() => expect(hasLabels()).toBe(true));
  });
  it("模型或其他右侧控件改变时重新试排，可在相同容器宽度恢复文字", async () => {
    metrics.expanded = 380;
    const view = render(
      createElement(Footer, { actions: "长模型名称 语音 发送" }),
    );
    expect(hasLabels()).toBe(false);
    metrics.expanded = 280;
    view.rerender(createElement(Footer, { actions: "发送" }));
    await waitFor(() => expect(hasLabels()).toBe(true));
    metrics.expanded = 380;
    view.rerender(createElement(Footer, { actions: "长模型名称 语音 发送" }));
    await waitFor(() => expect(hasLabels()).toBe(false));
  });
  it("字体加载使按钮实际宽度变大时也能收起文字", async () => {
    render(createElement(Footer));
    expect(hasLabels()).toBe(true);
    metrics.expanded = 360;
    notifyResize(screen.getByTestId("leading"));
    await waitFor(() => expect(hasLabels()).toBe(false));
  });
});

describe("resolvePromptInputFooterLayout", () => {
  it("完整模式发生溢出时统一收起为图标", () => {
    expect(resolvePromptInputFooterLayout(true)).toBe("collapsed");
  });

  it("完整模式未溢出时保留按钮文字", () => {
    expect(resolvePromptInputFooterLayout(false)).toBe("expanded");
  });
});

describe("shouldProbePromptInputFooterAfterContentChange", () => {
  it("纯图标模式选择知识库或 Skill 后重新试排，并按溢出结果保持收起", () => {
    expect(
      shouldProbePromptInputFooterAfterContentChange(
        PromptInputFooterLayoutMode.Collapsed,
      ),
    ).toBe(true);
    expect(resolvePromptInputFooterLayout(true)).toBe("collapsed");
  });

  it("内容变短且完整模式可容纳时允许恢复文字", () => {
    expect(
      shouldProbePromptInputFooterAfterContentChange(
        PromptInputFooterLayoutMode.Collapsed,
      ),
    ).toBe(true);
    expect(resolvePromptInputFooterLayout(false)).toBe("expanded");
  });

  it("试排期间忽略由自身增删文字产生的内容变化", () => {
    expect(
      shouldProbePromptInputFooterAfterContentChange(
        PromptInputFooterLayoutMode.Probing,
      ),
    ).toBe(false);
  });
});

describe("shouldProbePromptInputFooterAfterResize", () => {
  it("完整模式的 footer 宽度变化后重新测量", () => {
    expect(
      shouldProbePromptInputFooterAfterResize({
        failedAtWidth: null,
        mode: PromptInputFooterLayoutMode.Expanded,
        nextWidth: 639,
        previousWidth: 640,
      }),
    ).toBe(false);

    expect(
      shouldProbePromptInputFooterAfterResize({
        failedAtWidth: null,
        mode: PromptInputFooterLayoutMode.Expanded,
        nextWidth: 620,
        previousWidth: 640,
      }),
    ).toBe(true);
  });

  it("纯图标模式变窄时不尝试恢复文字", () => {
    expect(
      shouldProbePromptInputFooterAfterResize({
        failedAtWidth: 640,
        mode: PromptInputFooterLayoutMode.Collapsed,
        nextWidth: 600,
        previousWidth: 640,
      }),
    ).toBe(false);
  });

  it("纯图标模式获得足够额外空间后重新试排完整模式", () => {
    expect(
      shouldProbePromptInputFooterAfterResize({
        failedAtWidth: 640,
        mode: PromptInputFooterLayoutMode.Collapsed,
        nextWidth: 640 + PROMPT_INPUT_FOOTER_RESTORE_HYSTERESIS_PX - 1,
        previousWidth: 640,
      }),
    ).toBe(false);

    expect(
      shouldProbePromptInputFooterAfterResize({
        failedAtWidth: 640,
        mode: PromptInputFooterLayoutMode.Collapsed,
        nextWidth: 640 + PROMPT_INPUT_FOOTER_RESTORE_HYSTERESIS_PX,
        previousWidth: 640,
      }),
    ).toBe(true);
  });

  it("试排期间忽略 ResizeObserver 回调", () => {
    expect(
      shouldProbePromptInputFooterAfterResize({
        failedAtWidth: 640,
        mode: PromptInputFooterLayoutMode.Probing,
        nextWidth: 680,
        previousWidth: 640,
      }),
    ).toBe(false);
  });
});
