"use client";

/**
 * 管理聊天输入框底部工具区的自适应布局。
 * 使用 DOM 实际尺寸而非容器查询，确保 Chromium 102 也能正确降级按钮文字。
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export enum PromptInputFooterLayoutMode {
  Expanded = "expanded",
  Collapsed = "collapsed",
  Probing = "probing",
}

/** DOM 宽度计算存在小数舍入，预留 1px 避免临界宽度反复切换。 */
export const PROMPT_INPUT_FOOTER_WIDTH_TOLERANCE_PX = 1;

/** 收起后需要获得一段明确的额外空间才重试完整模式，避免临界宽度反复切换。 */
export const PROMPT_INPUT_FOOTER_RESTORE_HYSTERESIS_PX = 8;

const TOOL_CONTENT_OBSERVER_OPTIONS: MutationObserverInit = {
  attributes: true,
  attributeFilter: ["aria-label", "title"],
  characterData: true,
  childList: true,
  subtree: true,
};

/** 根据完整模式的真实溢出结果决定最终布局。 */
export function resolvePromptInputFooterLayout(
  overflows: boolean,
): PromptInputFooterLayoutMode {
  return overflows
    ? PromptInputFooterLayoutMode.Collapsed
    : PromptInputFooterLayoutMode.Expanded;
}

/** 判断业务工具内容变化后是否需要重新试排完整模式。 */
export function shouldProbePromptInputFooterAfterContentChange(
  mode: PromptInputFooterLayoutMode,
): boolean {
  return mode !== PromptInputFooterLayoutMode.Probing;
}

/** 判断 footer 宽度变化后是否需要重新试排完整模式。 */
export function shouldProbePromptInputFooterAfterResize({
  failedAtWidth,
  mode,
  nextWidth,
  previousWidth,
}: {
  failedAtWidth: number | null;
  mode: PromptInputFooterLayoutMode;
  nextWidth: number;
  previousWidth: number;
}): boolean {
  if (
    Math.abs(nextWidth - previousWidth) <=
      PROMPT_INPUT_FOOTER_WIDTH_TOLERANCE_PX ||
    mode === PromptInputFooterLayoutMode.Probing
  ) {
    return false;
  }

  if (mode === PromptInputFooterLayoutMode.Expanded) {
    return true;
  }

  const retryFromWidth = failedAtWidth ?? previousWidth;
  return (
    nextWidth >= retryFromWidth + PROMPT_INPUT_FOOTER_RESTORE_HYSTERESIS_PX
  );
}

/**
 * 根据底部工具区的实际剩余宽度，在带文字和纯图标布局之间切换。
 *
 * probing 会短暂渲染完整模式，并在布局阶段同步测量；测量完成前不会交给浏览器绘制，
 * 因此业务内容变化可以重新计算宽度，同时不会产生可见的按钮跳变。
 */
export function usePromptInputFooterLayout() {
  const footerRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutModeState] =
    useState<PromptInputFooterLayoutMode>(PromptInputFooterLayoutMode.Probing);
  const layoutModeRef = useRef<PromptInputFooterLayoutMode>(
    PromptInputFooterLayoutMode.Probing,
  );
  const failedAtWidthRef = useRef<number | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  const setLayoutMode = useCallback((nextMode: PromptInputFooterLayoutMode) => {
    if (layoutModeRef.current === nextMode) return;

    layoutModeRef.current = nextMode;
    setLayoutModeState(nextMode);
  }, []);

  const startProbe = useCallback(() => {
    if (layoutModeRef.current === PromptInputFooterLayoutMode.Probing) return;

    // probing 会增删按钮文字节点，先暂停观察，避免把自身变化当成业务内容变化。
    mutationObserverRef.current?.disconnect();
    mutationObserverRef.current = null;
    setLayoutMode(PromptInputFooterLayoutMode.Probing);
  }, [setLayoutMode]);

  useLayoutEffect(() => {
    layoutModeRef.current = layoutMode;
    if (layoutMode !== PromptInputFooterLayoutMode.Probing) return;

    const footer = footerRef.current;
    const tools = toolsRef.current;
    if (!footer || !tools) return;

    // tools 包含左右两侧，压缩左侧文字时仍为模型、语音、用量圆环和发送按钮留出空间。
    const overflows =
      tools.scrollWidth >
      tools.clientWidth + PROMPT_INPUT_FOOTER_WIDTH_TOLERANCE_PX;
    const nextMode = resolvePromptInputFooterLayout(overflows);
    failedAtWidthRef.current = overflows ? footer.clientWidth : null;
    setLayoutMode(nextMode);
  }, [layoutMode, setLayoutMode]);

  useEffect(() => {
    if (layoutMode !== PromptInputFooterLayoutMode.Expanded) return;

    const footer = footerRef.current;
    const tools = toolsRef.current;
    if (!footer || !tools) return;

    let animationFrameId: number | null = null;
    const collapseIfOverflowing = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = null;
        if (
          layoutModeRef.current === PromptInputFooterLayoutMode.Expanded &&
          tools.scrollWidth >
            tools.clientWidth + PROMPT_INPUT_FOOTER_WIDTH_TOLERANCE_PX
        ) {
          failedAtWidthRef.current = footer.clientWidth;
          setLayoutMode(PromptInputFooterLayoutMode.Collapsed);
        }
      });
    };

    // 字体加载或按钮内部布局稳定后，文字宽度可能变化但 DOM 与 footer 宽度不变。
    // 观察每个工具项可覆盖这种场景，避免首轮布局阶段的测量结果过早失效。
    const toolSizeObserver = new ResizeObserver(collapseIfOverflowing);
    for (const child of tools.children) {
      if (child instanceof HTMLElement) {
        toolSizeObserver.observe(child);
      }
    }
    collapseIfOverflowing();

    return () => {
      toolSizeObserver.disconnect();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [layoutMode, setLayoutMode]);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    let previousWidth = footer.clientWidth;
    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = footer.clientWidth;
      const shouldProbe = shouldProbePromptInputFooterAfterResize({
        failedAtWidth: failedAtWidthRef.current,
        mode: layoutModeRef.current,
        nextWidth,
        previousWidth,
      });

      previousWidth = nextWidth;
      if (shouldProbe) {
        startProbe();
      }
    });

    resizeObserver.observe(footer);
    return () => resizeObserver.disconnect();
  }, [startProbe]);

  useLayoutEffect(() => {
    const tools = toolsRef.current;
    if (!tools || layoutMode === PromptInputFooterLayoutMode.Probing) return;

    const mutationObserver = new MutationObserver(() => {
      mutationObserver.disconnect();
      if (mutationObserverRef.current === mutationObserver) {
        mutationObserverRef.current = null;
      }
      if (
        shouldProbePromptInputFooterAfterContentChange(layoutModeRef.current)
      ) {
        startProbe();
      }
    });

    mutationObserverRef.current = mutationObserver;
    mutationObserver.observe(tools, TOOL_CONTENT_OBSERVER_OPTIONS);
    return () => {
      mutationObserver.disconnect();
      if (mutationObserverRef.current === mutationObserver) {
        mutationObserverRef.current = null;
      }
    };
  }, [layoutMode, startProbe]);

  return {
    footerRef,
    showToolLabels: layoutMode !== PromptInputFooterLayoutMode.Collapsed,
    toolsRef,
  };
}
