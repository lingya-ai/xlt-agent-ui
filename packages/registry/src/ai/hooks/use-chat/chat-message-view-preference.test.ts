// @vitest-environment jsdom
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMessageViewController } from "../../agents/message-view-controller";
import {
  CHAT_MESSAGE_VIEW_STORAGE_KEY,
  ChatMessageViewMode,
  parseStoredChatMessageViewMode,
  useChatMessageViewPreference,
} from "./chat-message-view-preference";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("消息展示偏好", () => {
  it("仅接受枚举值，非法数据回退compact", () => {
    expect(parseStoredChatMessageViewMode("full")).toBe(
      ChatMessageViewMode.Full,
    );
    for (const value of [null, undefined, "legacy", '"full"', {}, 1]) {
      expect(parseStoredChatMessageViewMode(value)).toBe(
        ChatMessageViewMode.Compact,
      );
    }
  });

  it("SSR与客户端首帧均compact，挂载后恢复full", async () => {
    window.localStorage.setItem(CHAT_MESSAGE_VIEW_STORAGE_KEY, "full");
    const read = vi.spyOn(Storage.prototype, "getItem");
    function Preview() {
      const preference = useChatMessageViewPreference();
      return createElement("span", null, preference.mode);
    }
    expect(renderToString(createElement(Preview))).toBe("<span>compact</span>");
    expect(read).not.toHaveBeenCalled();
    const frames: string[] = [];
    const hook = renderHook(() => {
      const preference = useChatMessageViewPreference();
      frames.push(preference.mode);
      return preference;
    });
    expect(frames[0]).toBe("compact");
    await waitFor(() => expect(hook.result.current.mode).toBe("full"));
  });

  it("持久化并同步同页实例及跨标签storage事件", async () => {
    const first = renderHook(() => useChatMessageViewPreference());
    const second = renderHook(() => useChatMessageViewPreference());
    act(() => expect(first.result.current.setMode("full")).toBe(true));
    await waitFor(() => expect(second.result.current.mode).toBe("full"));
    window.localStorage.setItem(CHAT_MESSAGE_VIEW_STORAGE_KEY, "compact");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: CHAT_MESSAGE_VIEW_STORAGE_KEY,
          storageArea: window.localStorage,
          oldValue: "full",
          newValue: "compact",
        }),
      ),
    );
    await waitFor(() => expect(first.result.current.mode).toBe("compact"));
  });

  it("保存失败保留内存模式，连续失败只提供一次通知", async () => {
    const hook = renderHook(() => useChatMessageViewPreference());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => expect(hook.result.current.setMode("full")).toBe(false));
    await waitFor(() =>
      expect(hook.result.current.error?.message).toBe("quota"),
    );
    expect(hook.result.current.mode).toBe("full");
    act(() => hook.result.current.clearError());
    act(() => hook.result.current.setMode("compact"));
    await act(async () => {});
    expect(hook.result.current.error).toBeUndefined();
    expect(hook.result.current.mode).toBe("compact");
  });

  it("存储本身不可访问时仍允许内存切换", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("security");
    });
    const hook = renderHook(() => useChatMessageViewPreference());
    await waitFor(() =>
      expect(hook.result.current.error?.message).toBe("security"),
    );
    act(() => hook.result.current.clearError());
    act(() => expect(hook.result.current.setMode("full")).toBe(false));
    await act(async () => {});
    expect(hook.result.current.mode).toBe("full");
    expect(hook.result.current.error).toBeUndefined();
  });

  it("一次成功写入后允许下一次失败重新通知", async () => {
    const hook = renderHook(() => useChatMessageViewPreference());
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    act(() => hook.result.current.setMode("full"));
    await waitFor(() => expect(hook.result.current.error).toBeDefined());
    act(() => hook.result.current.clearError());
    write.mockRestore();
    act(() => expect(hook.result.current.setMode("compact")).toBe(true));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota-again");
    });
    act(() => hook.result.current.setMode("full"));
    await waitFor(() =>
      expect(hook.result.current.error?.message).toBe("quota-again"),
    );
  });

  it("读取失败回退compact且不重复通知", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const hook = renderHook(() => useChatMessageViewPreference());
    await waitFor(() =>
      expect(hook.result.current.error?.message).toBe("denied"),
    );
    act(() => hook.result.current.clearError());
    act(() => hook.result.current.setMode("full"));
    await act(async () => {});
    expect(hook.result.current.mode).toBe("full");
    expect(hook.result.current.error).toBeUndefined();
  });
});

describe("模式控制器", () => {
  it("受控mode优先于defaultMode和偏好，变化仅调用回调", () => {
    window.localStorage.setItem(CHAT_MESSAGE_VIEW_STORAGE_KEY, "full");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const onModeChange = vi.fn();
    const hook = renderHook(() =>
      useMessageViewController({
        mode: "compact",
        defaultMode: "full",
        onModeChange,
      }),
    );
    act(() => hook.result.current.changeMode("full"));
    expect(hook.result.current.mode).toBe("compact");
    expect(onModeChange).toHaveBeenCalledWith("full");
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("显式defaultMode为独立非受控，变化仍调用回调且不读写共享偏好", () => {
    window.localStorage.setItem(CHAT_MESSAGE_VIEW_STORAGE_KEY, "full");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const onModeChange = vi.fn();
    const hook = renderHook(() =>
      useMessageViewController({ defaultMode: "compact", onModeChange }),
    );
    act(() => hook.result.current.changeMode("full"));
    expect(hook.result.current.mode).toBe("full");
    expect(onModeChange).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("默认非受控恢复共享偏好，切换不重新挂载Hook", async () => {
    window.localStorage.setItem(CHAT_MESSAGE_VIEW_STORAGE_KEY, "full");
    const onModeChange = vi.fn();
    const hook = renderHook(() => useMessageViewController({ onModeChange }));
    const rootRef = hook.result.current.scrollRootRef;
    await waitFor(() => expect(hook.result.current.mode).toBe("full"));
    act(() => hook.result.current.changeMode("compact"));
    expect(hook.result.current.scrollRootRef).toBe(rootRef);
    expect(onModeChange).toHaveBeenCalledWith("compact");
    expect(window.localStorage.getItem(CHAT_MESSAGE_VIEW_STORAGE_KEY)).toBe(
      "compact",
    );
  });
});
