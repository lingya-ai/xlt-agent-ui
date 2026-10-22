// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import {
  captureMessageScrollPosition,
  restoreMessageScrollPosition,
  STICK_TO_BOTTOM_THRESHOLD,
} from "./message-scroll-anchor";

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 500,
    width: 500,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

function createList() {
  const root = document.createElement("div");
  root.innerHTML =
    '<div><div data-chat-scroll><div data-chat-message-list><div data-message-id="old"></div><div data-message-id="visible"></div><div data-message-id="overscan"></div></div></div></div>';
  const viewport = root.firstElementChild;
  const rows = root.querySelectorAll<HTMLElement>("[data-message-id]");
  if (!(viewport instanceof HTMLElement) || !rows[0] || !rows[1] || !rows[2])
    throw new Error("测试DOM不完整");
  Object.defineProperties(viewport, {
    scrollHeight: { value: 1000, configurable: true },
    clientHeight: { value: 300 },
  });
  viewport.scrollTop = 200;
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(rect(100, 400));
  vi.spyOn(rows[0], "getBoundingClientRect").mockReturnValue(rect(-100, 90));
  const visibleRect = vi
    .spyOn(rows[1], "getBoundingClientRect")
    .mockReturnValue(rect(80, 230));
  vi.spyOn(rows[2], "getBoundingClientRect").mockReturnValue(rect(450, 600));
  return { root, viewport, visibleRect, visibleRow: rows[1] };
}

describe("消息滚动锚点", () => {
  it("与虚拟列表统一70px底部阈值，并恢复新底部", () => {
    expect(STICK_TO_BOTTOM_THRESHOLD).toBe(70);
    const { root, viewport } = createList();
    viewport.scrollTop = 630;
    const anchor = captureMessageScrollPosition(root);
    expect(anchor).toEqual({ kind: "bottom" });
    if (!anchor) throw new Error("缺少锚点");
    viewport.scrollTop = 629;
    expect(captureMessageScrollPosition(root)?.kind).toBe("message");
    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    restoreMessageScrollPosition(root, anchor);
    expect(viewport.scrollTop).toBe(1400);
  });

  it("跨过overscan记录首个可见行偏移并恢复", () => {
    const { root, viewport, visibleRect } = createList();
    const anchor = captureMessageScrollPosition(root);
    expect(anchor).toEqual({
      kind: "message",
      messageId: "visible",
      offsetTop: -20,
    });
    if (!anchor) throw new Error("缺少锚点");
    visibleRect.mockReturnValue(rect(180, 330));
    restoreMessageScrollPosition(root, anchor);
    expect(viewport.scrollTop).toBe(300);
  });

  it("缺少容器或锚点已卸载时安全跳过", () => {
    expect(captureMessageScrollPosition(null)).toBeUndefined();
    expect(
      captureMessageScrollPosition(document.createElement("div")),
    ).toBeUndefined();
    const { root, viewport, visibleRow } = createList();
    const anchor = captureMessageScrollPosition(root);
    if (!anchor) throw new Error("缺少锚点");
    visibleRow.remove();
    restoreMessageScrollPosition(root, anchor);
    expect(viewport.scrollTop).toBe(200);
    expect(captureMessageScrollPosition(root)).toBeUndefined();
    restoreMessageScrollPosition(null, anchor);
  });
});
