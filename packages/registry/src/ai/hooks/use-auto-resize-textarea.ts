"use client"

import {useEffect, type RefObject} from "react"

export const DEFAULT_AUTO_RESIZE_TEXTAREA_MAX_HEIGHT_PX = 192

/**
 * 自动伸高 textarea 的 hook（兼容所有浏览器，替代 CSS `field-sizing: content`）
 *
 * 背景：`field-sizing: content` 是 Chrome 123+ 才支持的新特性，奇安信等国产 Chromium
 * 浏览器（尤其政企终端版本滞后）可能不支持或行为异常，导致 textarea 高度坍塌为 0。
 * 本 hook 通过 JS 监听 input 事件，重置高度后按 scrollHeight 自动调整，所有浏览器行为一致。
 *
 * @param ref textarea 的 ref
 * @param value 受控值（value 变化时也要重新计算高度，如外部 setValue 清空）
 * @param maxHeightPx 最大高度（像素），超出后出现滚动条；默认 192px（对应 max-h-48）
 *
 * @example
 * const ref = useRef<HTMLTextAreaElement>(null)
 * useAutoResizeTextarea(ref, value)
 * return <textarea ref={ref} value={value} onChange={...} />
 */
export function useAutoResizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxHeightPx = DEFAULT_AUTO_RESIZE_TEXTAREA_MAX_HEIGHT_PX,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const resize = () => {
      // 先重置为 auto，让浏览器按 rows 重新计算 scrollHeight
      el.style.height = "auto"
      // 按 scrollHeight 设置高度，但不超过 maxHeight
      const nextHeight = Math.min(el.scrollHeight, maxHeightPx)
      el.style.height = `${nextHeight}px`
      // 超过 maxHeight 时启用滚动条
      el.style.overflowY = el.scrollHeight > maxHeightPx ? "auto" : "hidden"
    }

    resize()

    // 监听 input 事件（捕获阶段，确保在受控 onChange 之前触发也能拿到最新值）
    el.addEventListener("input", resize)

    return () => {
      el.removeEventListener("input", resize)
    }
  }, [ref, value, maxHeightPx])
}
