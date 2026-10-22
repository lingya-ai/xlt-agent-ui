// @vitest-environment jsdom
import {createElement, type ReactNode} from "react"
import {cleanup, fireEvent, render, screen} from "@testing-library/react"
import {afterEach, expect, it, vi} from "vitest";

import type {ChatItem} from "../hooks/use-chat/types"
import {MessageNavigator} from "./message-navigator"

const scrollToIndex = vi.hoisted(() => vi.fn())
const virtualizerOptions = vi.hoisted(() => ({useFlushSync: true, useScrollendEvent: true}))

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: {useFlushSync: boolean; useScrollendEvent: boolean}) => {
    virtualizerOptions.useFlushSync = options.useFlushSync
    virtualizerOptions.useScrollendEvent = options.useScrollendEvent
    return {
      getTotalSize: () => 800,
      getVirtualItems: () => Array.from({length: 5}, (_, offset) => ({
        key: `message-${95 + offset}`,
        index: 95 + offset,
        start: (95 + offset) * 8,
      })),
      scrollToIndex,
    }
  },
}))

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => ({
    jumpToMessage: ({index}: {index: number}) => ({value: `跳转到消息 ${index}`}),
  }),
}))

vi.mock("../../ui/hooks/use-mobile", () => ({useIsMobile: () => false}))

vi.mock("../../ui/components/tooltip", () => ({
  Tooltip: ({children}: {children: ReactNode}) => createElement("div", null, children),
  TooltipTrigger: ({children}: {children: ReactNode}) => children,
  TooltipContent: ({children}: {children: ReactNode}) => createElement("div", null, children),
}))

afterEach(() => {
  cleanup()
  scrollToIndex.mockClear()
})

it("消息导航器只挂载固定高度虚拟窗口，并通过回调导航未挂载消息", () => {
  const items: ChatItem[] = Array.from({length: 100}, (_, index) => ({
    id: `message-${index}`,
    user: {text: `消息 ${index}`},
    assistant: [],
    loading: false,
    loaded: true,
  }))
  const onNavigate = vi.fn()
  const {container} = render(
    createElement(MessageNavigator, {
      items,
      activeMessageId: "message-97",
      onNavigate,
    }),
  )

  expect(container.querySelectorAll("button")).toHaveLength(5)
  expect(virtualizerOptions.useFlushSync).toBe(false)
  expect(virtualizerOptions.useScrollendEvent).toBe(false)
  expect(scrollToIndex).toHaveBeenCalledWith(97, {align: "auto", behavior: "auto"})
  fireEvent.click(screen.getByRole("button", {name: "消息 95"}))
  expect(onNavigate).toHaveBeenCalledWith("message-95", 95)
})
