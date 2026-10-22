// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => ({
    suspectedTitle: "可能延迟",
    suspectedDescription: "正在检查",
    suspectedBadge: "检查中",
    bufferedTitle: "回复延迟",
    bufferedDescription: "请重新检测",
    bufferedSwitchDescription: "可以切换协议",
    bufferedBadge: "显示延迟",
    switchToWebSocket: "切换到 WebSocket",
    continueSse: "继续使用 SSE",
    retry: "重新检测",
    checking: "检测中",
  }),
}));

import { ChatStreamStatusPanel } from "./chat-stream-status-panel";

afterEach(cleanup);

it("SSE 被确认缓存时展示协议选择并触发对应回调", () => {
  const onSwitchToWebSocket = vi.fn();
  const onContinueSse = vi.fn();
  render(
    createElement(ChatStreamStatusPanel, {
      status: {
        kind: "degraded",
        healthStatus: "buffered",
        isProbing: false,
      },
      onProbe: vi.fn(),
      showTransportSwitch: true,
      onSwitchToWebSocket,
      onContinueSse,
    }),
  );

  expect(screen.getByText("可以切换协议")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "切换到 WebSocket" }));
  fireEvent.click(screen.getByRole("button", { name: "继续使用 SSE" }));
  expect(onSwitchToWebSocket).toHaveBeenCalledTimes(1);
  expect(onContinueSse).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "重新检测" })).toBeNull();
});
