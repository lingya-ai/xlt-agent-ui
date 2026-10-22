// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CHAT_STREAM_TRANSPORT_STORAGE_KEY,
  parseStoredChatStreamTransport,
  useChatStreamTransportPreference,
} from "./chat-stream-transport";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("parseStoredChatStreamTransport", () => {
  it("接受有效协议值", () => {
    expect(parseStoredChatStreamTransport("sse")).toBe("sse");
    expect(parseStoredChatStreamTransport("ws")).toBe("ws");
  });

  it("缺失或非法值回退 SSE", () => {
    expect(parseStoredChatStreamTransport(null)).toBe("sse");
    expect(parseStoredChatStreamTransport("event-source")).toBe("sse");
  });
});

describe("useChatStreamTransportPreference", () => {
  it("缺少配置时使用 SSE，并同步同页的 Hook 实例", async () => {
    const first = renderHook(() => useChatStreamTransportPreference());
    const second = renderHook(() => useChatStreamTransportPreference());

    expect(first.result.current.transport).toBe("sse");
    expect(second.result.current.transport).toBe("sse");
    act(() => {
      expect(first.result.current.setTransport("ws")).toBe(true);
    });

    await waitFor(() => {
      expect(first.result.current.transport).toBe("ws");
      expect(second.result.current.transport).toBe("ws");
    });
    expect(window.localStorage.getItem(CHAT_STREAM_TRANSPORT_STORAGE_KEY)).toBe(
      "ws",
    );
  });

  it("响应其他标签页写入的 storage 事件", async () => {
    const hook = renderHook(() => useChatStreamTransportPreference());
    window.localStorage.setItem(CHAT_STREAM_TRANSPORT_STORAGE_KEY, "ws");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: CHAT_STREAM_TRANSPORT_STORAGE_KEY,
          newValue: "ws",
          oldValue: null,
          storageArea: window.localStorage,
        }),
      );
    });

    await waitFor(() => expect(hook.result.current.transport).toBe("ws"));
  });
});
