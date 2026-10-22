// @vitest-environment jsdom
import { createElement, useState } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  type ReasoningProps,
} from "./reasoning";

// 只替换重型Markdown依赖和字典，真实Reasoning及Radix披露状态继续参与测试。
vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: string }) =>
    createElement("pre", { "data-testid": "reasoning-text" }, children),
}));
vi.mock("@streamdown/cjk", () => ({ cjk: {} }));
vi.mock("@streamdown/code", () => ({ code: {} }));
vi.mock("@streamdown/math", () => ({ math: {} }));
vi.mock("@streamdown/mermaid", () => ({ mermaid: {} }));
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => ({
    thinking: "思考中",
    thoughtForFewSeconds: "已思考",
    thoughtForSeconds: ({ duration }: { duration: number }) =>
      `已思考${duration}秒`,
  }),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function content(props: ReasoningProps) {
  return createElement(
    Reasoning,
    props,
    createElement(ReasoningTrigger, null, "推理详情"),
    createElement(ReasoningContent, null, "保留完整推理文本"),
  );
}
function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe("Reasoning披露生命周期", () => {
  it("受控open=true超过1000ms仍打开且不产生自动onOpenChange", () => {
    const onOpenChange = vi.fn();
    const view = render(
      content({ open: true, isStreaming: false, onOpenChange }),
    );
    expect(view.getByTestId("reasoning-text").textContent).toBe(
      "保留完整推理文本",
    );
    advance(1000);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("受控open=false开始和结束streaming均不自动覆盖用户收纳", () => {
    const onOpenChange = vi.fn();
    const view = render(
      content({ open: false, isStreaming: true, onOpenChange }),
    );
    advance(2000);
    view.rerender(content({ open: false, isStreaming: false, onOpenChange }));
    advance(1000);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("用户通过受控回调收纳后，后续streaming变化与定时器不能重新打开或重复关闭", () => {
    const onChange = vi.fn();
    function Controlled({ streaming }: { streaming: boolean }) {
      const [open, setOpen] = useState(true);
      return content({
        open,
        isStreaming: streaming,
        onOpenChange: (next) => {
          onChange(next);
          setOpen(next);
        },
      });
    }
    const view = render(createElement(Controlled, { streaming: true }));
    fireEvent.click(view.getByRole("button"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
    view.rerender(createElement(Controlled, { streaming: false }));
    advance(1000);
    view.rerender(createElement(Controlled, { streaming: true }));
    advance(2000);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("非受控defaultOpen=true保留旧行为：结束流式后延迟关闭且只自动关闭一次", () => {
    const onOpenChange = vi.fn();
    const view = render(
      content({ defaultOpen: true, isStreaming: true, onOpenChange }),
    );
    advance(2000);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    view.rerender(
      content({ defaultOpen: true, isStreaming: false, onOpenChange }),
    );
    advance(999);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    advance(1);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    fireEvent.click(view.getByRole("button"));
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    view.rerender(
      content({ defaultOpen: true, isStreaming: true, onOpenChange }),
    );
    advance(1000);
    view.rerender(
      content({ defaultOpen: true, isStreaming: false, onOpenChange }),
    );
    advance(1000);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    expect(onOpenChange.mock.calls.map((call) => call[0])).toEqual([
      false,
      true,
    ]);
  });

  it("非受控defaultOpen=false不触发自动关闭，手动打开也不被timer覆盖", () => {
    const onOpenChange = vi.fn();
    const view = render(
      content({ defaultOpen: false, isStreaming: false, onOpenChange }),
    );
    fireEvent.click(view.getByRole("button"));
    advance(2000);
    expect(view.getByRole("button").getAttribute("aria-expanded")).toBe("true");
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});
