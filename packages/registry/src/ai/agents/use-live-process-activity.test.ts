// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProcessActivityKind,
  type ProcessActivity,
} from "./process-activity-summary";
import { ToolAction } from "../hooks/use-chat/schema";
import { useLiveProcessActivity } from "./use-live-process-activity";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("实时过程标题更新", () => {
  it.each([ProcessActivityKind.Tool, ProcessActivityKind.Reasoning])(
    "%s结束后的空档保留整份快照，新活动整体替换",
    (kind) => {
      const first: ProcessActivity = {
        kind,
        key: "first",
        action: kind === ProcessActivityKind.Tool ? ToolAction.READ : undefined,
        detail: "上一活动",
      };
      const idle: ProcessActivity = { kind: ProcessActivityKind.Idle };
      const view = renderHook(
        ({ activity, latest }) =>
          useLiveProcessActivity(activity, true, latest),
        { initialProps: { activity: first, latest: first } },
      );
      view.rerender({
        activity: idle,
        latest: { ...first, detail: "完成事件不替换预览" },
      });
      act(() => vi.advanceTimersByTime(1000));
      expect(view.result.current).toEqual(first);
      const next: ProcessActivity = {
        kind: ProcessActivityKind.Tool,
        key: "next",
        action: ToolAction.READ,
      };
      view.rerender({ activity: next, latest: next });
      expect(view.result.current).toEqual(next);
      expect(view.result.current.detail).toBeUndefined();
    },
  );

  it("快速工具在首次提交前结束，空档仍提交该真实候选，重挂载从投影恢复", () => {
    const first: ProcessActivity = {
      kind: ProcessActivityKind.Reasoning,
      key: "think",
      detail: "思考",
    };
    const next: ProcessActivity = {
      kind: ProcessActivityKind.Tool,
      key: "read",
      action: ToolAction.READ,
      preparing: false,
      detail: "读取",
    };
    const idle: ProcessActivity = { kind: ProcessActivityKind.Idle };
    const view = renderHook(
      ({ activity, latest }) => useLiveProcessActivity(activity, true, latest),
      { initialProps: { activity: first, latest: first } },
    );
    act(() => vi.advanceTimersByTime(50));
    view.rerender({ activity: next, latest: next });
    view.rerender({ activity: idle, latest: next });
    act(() => vi.advanceTimersByTime(100));
    expect(view.result.current).toEqual(next);
    view.unmount();
    const remounted = renderHook(() =>
      useLiveProcessActivity(idle, true, next),
    );
    expect(remounted.result.current).toEqual(next);
  });

  it("至少保持150ms，快速变化只提交最新动作、准备状态和详情", () => {
    const first = {
      kind: ProcessActivityKind.Tool,
      key: "first",
      action: ToolAction.READ,
      preparing: true,
      detail: "初始",
    };
    const view = renderHook(
      ({ desired, active }) => useLiveProcessActivity(desired, active),
      { initialProps: { desired: first, active: true } },
    );
    act(() => vi.advanceTimersByTime(50));
    view.rerender({ desired: { ...first, detail: "中间" }, active: true });
    act(() => vi.advanceTimersByTime(50));
    const latest = {
      kind: ProcessActivityKind.Tool,
      key: "next",
      action: ToolAction.SEARCH,
      preparing: false,
      detail: "最新",
    };
    view.rerender({ desired: latest, active: true });
    expect(view.result.current).toEqual(first);
    act(() => vi.advanceTimersByTime(49));
    expect(view.result.current).toEqual(first);
    act(() => vi.advanceTimersByTime(1));
    expect(view.result.current).toEqual(latest);
    act(() => vi.advanceTimersByTime(10));
    view.rerender({ desired: { ...latest, detail: "下一条" }, active: true });
    act(() => vi.advanceTimersByTime(139));
    expect(view.result.current).toEqual(latest);
    act(() => vi.advanceTimersByTime(1));
    expect(view.result.current.detail).toBe("下一条");
  });

  it("完成立即切换，取消排队预览，重新执行和虚拟行重挂载使用当前数据", () => {
    const view = renderHook(
      ({ detail, active }) =>
        useLiveProcessActivity(
          { kind: ProcessActivityKind.Reasoning, key: "think", detail },
          active,
        ),
      { initialProps: { detail: "初始", active: true } },
    );
    view.rerender({ detail: "待提交", active: true });
    view.rerender({ detail: "完成", active: false });
    expect(view.result.current.detail).toBe("完成");
    act(() => vi.advanceTimersByTime(200));
    expect(view.result.current.detail).toBe("完成");
    view.rerender({ detail: "新执行", active: true });
    expect(view.result.current.detail).toBe("新执行");
    view.rerender({ detail: "卸载前待提交", active: true });
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    const remounted = renderHook(() =>
      useLiveProcessActivity(
        {
          kind: ProcessActivityKind.Reasoning,
          key: "think",
          detail: "当前数据",
        },
        true,
      ),
    );
    expect(remounted.result.current.detail).toBe("当前数据");
  });
});
