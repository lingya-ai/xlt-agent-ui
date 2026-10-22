// @vitest-environment jsdom
import {createElement, type ReactNode} from "react"
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react"
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"

import type {ChatItem} from "../hooks/use-chat/types"
import {VirtualizedMessageList} from "./virtualized-message-list"

interface TestVirtualItem {
  key: string
  index: number
  start: number
  end: number
  size: number
  lane: number
}

interface VirtualizerOptions {
  count: number
  overscan: number
  estimateSize: () => number
  anchorTo: string
  followOnAppend: string
  scrollEndThreshold: number
  useFlushSync: boolean
  useScrollendEvent: boolean
  onChange: (instance: {isAtEnd: (threshold: number) => boolean}) => void
}

const virtualizerState = vi.hoisted(() => ({
  items: [] as TestVirtualItem[],
  options: undefined as VirtualizerOptions | undefined,
  scrollOffset: 0,
  viewportHeight: 720,
  isAtEnd: true,
  measureElement: vi.fn(),
  scrollToEnd: vi.fn(),
  scrollToIndex: vi.fn(),
}))

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: VirtualizerOptions) => {
    virtualizerState.options = options
    return {
      getVirtualItems: () => virtualizerState.items,
      getTotalSize: () => options.count * options.estimateSize(),
      measureElement: virtualizerState.measureElement,
      scrollOffset: virtualizerState.scrollOffset,
      scrollRect: {height: virtualizerState.viewportHeight},
      scrollToEnd: virtualizerState.scrollToEnd,
      scrollToIndex: virtualizerState.scrollToIndex,
      isAtEnd: () => virtualizerState.isAtEnd,
    }
  },
}))

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => ({scrollToBottom: {value: "回到底部"}}),
}))

vi.mock("./message-navigator", () => ({
  MessageNavigator: ({
    items,
    onNavigate,
  }: {
    items: ChatItem[]
    onNavigate?: (messageId: string, index: number) => void
  }) => createElement("button", {type: "button", onClick: () => onNavigate?.(items[20]?.id ?? "", 20)}, "跳转消息"),
}))

vi.mock("../../ui/components/button", () => ({
  Button: ({children, ...props}: {children: ReactNode; [key: string]: unknown}) =>
    createElement("button", props, children),
}))

function createMessages(count: number): ChatItem[] {
  return Array.from({length: count}, (_, index) => ({
    id: `message-${index}`,
    loading: false,
    loaded: true,
    assistant: [],
  }))
}

function setVirtualWindow(startIndex: number, count: number) {
  virtualizerState.scrollOffset = startIndex * 240
  virtualizerState.items = Array.from({length: count}, (_, offset) => {
    const index = startIndex + offset
    return {
      key: `message-${index}`,
      index,
      start: index * 240,
      end: (index + 1) * 240,
      size: 240,
      lane: 0,
    }
  })
}

beforeEach(() => {
  virtualizerState.options = undefined
  virtualizerState.isAtEnd = true
  virtualizerState.measureElement.mockClear()
  virtualizerState.scrollToEnd.mockClear()
  virtualizerState.scrollToIndex.mockClear()
  setVirtualWindow(95, 5)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("动态高度消息虚拟列表", () => {
  it("只挂载虚拟窗口内的消息，并使用兼容 Chromium 102 的配置", () => {
    const items = createMessages(100)
    const {container} = render(
      createElement(VirtualizedMessageList, {
        items,
        showMessageNavigator: false,
        renderItem: (item: ChatItem) => createElement("span", null, item.id),
      }),
    )

    const rows = container.querySelectorAll("[data-chat-message-list] > [data-message-id]")
    expect(rows).toHaveLength(5)
    expect(rows[0]?.getAttribute("data-message-id")).toBe("message-95")
    expect(rows[4]?.getAttribute("data-message-id")).toBe("message-99")
    expect(virtualizerState.options?.overscan).toBe(3)
    expect(virtualizerState.options?.estimateSize()).toBe(240)
    expect(virtualizerState.options?.anchorTo).toBe("end")
    expect(virtualizerState.options?.followOnAppend).toBe("auto")
    expect(virtualizerState.options?.scrollEndThreshold).toBe(70)
    expect(virtualizerState.options?.useFlushSync).toBe(false)
    expect(virtualizerState.options?.useScrollendEvent).toBe(false)
    expect(virtualizerState.measureElement).toHaveBeenCalledTimes(5)
    expect(virtualizerState.scrollToEnd).toHaveBeenCalledWith({behavior: "auto"})
  })

  it("接近顶部时只触发一次上一页加载", async () => {
    setVirtualWindow(1, 5)
    const onLoadOlderMessages = vi.fn()
    const props = {
      items: createMessages(100),
      showMessageNavigator: false,
      hasOlderMessages: true,
      onLoadOlderMessages,
      renderItem: (item: ChatItem) => createElement("span", null, item.id),
    }
    const view = render(createElement(VirtualizedMessageList, props))

    await waitFor(() => expect(onLoadOlderMessages).toHaveBeenCalledTimes(1))
    view.rerender(createElement(VirtualizedMessageList, props))
    expect(onLoadOlderMessages).toHaveBeenCalledTimes(1)
  })

  it("导航到未挂载消息时瞬时定位并在下一帧校准", () => {
    let nextFrame: FrameRequestCallback | undefined
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextFrame = callback
      return 1
    })
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    render(
      createElement(VirtualizedMessageList, {
        items: createMessages(100),
        showMessageNavigator: true,
        renderItem: (item: ChatItem) => createElement("span", null, item.id),
      }),
    )
    fireEvent.click(screen.getByRole("button", {name: "跳转消息"}))

    expect(virtualizerState.scrollToIndex).toHaveBeenCalledWith(20, {
      align: "start",
      behavior: "auto",
    })
    act(() => nextFrame?.(0))
    expect(virtualizerState.scrollToIndex).toHaveBeenCalledTimes(2)
  })

  it("用户离开底部后显示回到底部入口", () => {
    virtualizerState.isAtEnd = false
    render(
      createElement(VirtualizedMessageList, {
        items: createMessages(100),
        showMessageNavigator: false,
        renderItem: (item: ChatItem) => createElement("span", null, item.id),
      }),
    )

    act(() => {
      virtualizerState.options?.onChange({isAtEnd: () => false})
    })
    fireEvent.click(screen.getByRole("button", {name: "回到底部"}))
    expect(virtualizerState.scrollToEnd).toHaveBeenLastCalledWith({behavior: "auto"})
  })
})
