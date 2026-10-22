"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAgentMessages } from "../../i18n/runtime";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/components/tooltip";
import { useIsMobile } from "../../ui/hooks/use-mobile";
import { cn } from "../../ui/lib/utils";

import { ConversationMessageStatus } from "../hooks/use-chat/conversation-message";
import { type ChatItem } from "../hooks/use-chat/types";

const NAVIGATOR_ROW_HEIGHT = 8;
const NAVIGATOR_VERTICAL_PADDING = 16;
const NAVIGATOR_SAFE_GAP = 8;
const NAVIGATOR_ACTIVE_SCALE = 1.5;
const NAVIGATOR_OVERSCAN = 4;
const NAVIGATOR_INTERACTION_SCALES = [2.25, 1.75, 1.4, 1.15] as const;

function getIndicatorScale(
  index: number,
  interactionIndex: number | null,
  isActive: boolean,
) {
  const activeScale = isActive ? NAVIGATOR_ACTIVE_SCALE : 1;
  if (interactionIndex === null) return activeScale;

  const distance = Math.abs(index - interactionIndex);
  const interactionScale = NAVIGATOR_INTERACTION_SCALES[distance] ?? 1;
  return Math.max(activeScale, interactionScale);
}

interface MessageNavigatorProps {
  items: ChatItem[];
  /** 由虚拟消息列表提供的当前可见消息；未提供时保留 DOM 观察回退。 */
  activeMessageId?: string;
  /** 虚拟消息列表的导航入口；未提供时保留 DOM 查询回退。 */
  onNavigate?: (messageId: string, index: number) => void;
}

/**
 * 消息导航组件。
 *
 * 导航项直接使用父级已经渲染的消息列表，确保流式新增、历史初始化和分页加载与页面内容同步。
 * 默认显示高密度消息指示点，hover 或键盘聚焦单个指示点后通过 Tooltip 显示用户问题原文。
 * 超长列表限制在聊天视口内滚动，并自动保持当前消息对应的导航项可见。
 *
 * @author 思追(shaco)
 */
export function MessageNavigator({ items, activeMessageId, onNavigate }: MessageNavigatorProps) {
  const t = useAgentMessages("message-navigator");
  const isMobile = useIsMobile();
  const navigatorRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [observedActiveMessageId, setObservedActiveMessageId] = useState<string>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const interactionIndex = hoveredIndex ?? focusedIndex;
  const resolvedActiveMessageId = onNavigate ? activeMessageId : observedActiveMessageId;

  // 只在消息 ID 集合变化时重建观察器，避免流式内容更新导致频繁解绑和重绑。
  const messageIdsKey = `${items.length}:${items[0]?.id ?? ""}:${items[items.length - 1]?.id ?? ""}`;
  const navigatorVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollViewportRef.current,
    getItemKey: index => items[index]?.id ?? index,
    estimateSize: () => NAVIGATOR_ROW_HEIGHT,
    overscan: NAVIGATOR_OVERSCAN,
    paddingStart: NAVIGATOR_VERTICAL_PADDING / 2,
    paddingEnd: NAVIGATOR_VERTICAL_PADDING / 2,
    // scrollToIndex 可能在布局副作用中运行，避免 React 19 生命周期内嵌套 flushSync。
    useFlushSync: false,
    useScrollendEvent: false,
  });

  const scrollToMessage = useCallback((messageId: string, index: number) => {
    if (onNavigate) {
      onNavigate(messageId, index);
      return;
    }
    const chatContainer = navigatorRef.current?.closest<HTMLElement>(
      "[data-chat-container]",
    );
    const messageList = chatContainer?.querySelector<HTMLElement>(
      "[data-chat-message-list]",
    );
    if (!messageList) return;

    const target = Array.from(messageList.children).find(
      (element) =>
        element instanceof HTMLElement &&
        element.dataset.messageId === messageId,
    );
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [onNavigate]);

  // 仅观察当前聊天实例的直属消息，避免主会话与嵌套子会话互相串线。
  useEffect(() => {
    if (onNavigate) {
      setObservedActiveMessageId(undefined);
      return;
    }

    if (isMobile) {
      setObservedActiveMessageId(undefined);
      return;
    }

    const chatContainer = navigatorRef.current?.closest<HTMLElement>(
      "[data-chat-container]",
    );
    const scrollContent =
      chatContainer?.querySelector<HTMLElement>("[data-chat-scroll]");
    const messageList = scrollContent?.querySelector<HTMLElement>(
      "[data-chat-message-list]",
    );
    const scrollContainer = scrollContent?.parentElement;
    if (!messageList || !scrollContainer) {
      setObservedActiveMessageId(undefined);
      return;
    }

    const messages = Array.from(messageList.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && Boolean(element.dataset.messageId),
    );
    const currentMessageIds = new Set(
      messages.map((element) => element.dataset.messageId),
    );
    setObservedActiveMessageId((current) =>
      current && currentMessageIds.has(current) ? current : undefined,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;

        // 聊天消息从上到下排列，取最底部的可见消息作为当前活跃项。
        const bottom = visible.reduce((previous, current) =>
          previous.boundingClientRect.top > current.boundingClientRect.top
            ? previous
            : current,
        );
        setObservedActiveMessageId(
          bottom.target.getAttribute("data-message-id") ?? undefined,
        );
      },
      { root: scrollContainer, threshold: 0.5 },
    );

    messages.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [isMobile, messageIdsKey, onNavigate]);

  // 当前消息变化或历史消息插入后，只在导航项离开视口时滚动到最近边界。
  useLayoutEffect(() => {
    if (!resolvedActiveMessageId) return;
    const activeIndex = items.findIndex(item => item.id === resolvedActiveMessageId);
    if (activeIndex < 0) return;
    navigatorVirtualizer.scrollToIndex(activeIndex, {align: "auto", behavior: "auto"});
  }, [items, messageIdsKey, navigatorVirtualizer, resolvedActiveMessageId]);

  // 没有消息时不显示；移动端 hover 交互不可用且窄条会遮挡用户消息。
  if (items.length === 0 || isMobile) return null;

  const navigatorContentHeight =
    items.length * NAVIGATOR_ROW_HEIGHT + NAVIGATOR_VERTICAL_PADDING;

  return (
    <div
      ref={navigatorRef}
      data-message-navigator
      onMouseLeave={() => setHoveredIndex(null)}
      className="absolute right-4 top-0 bottom-0 z-40 flex w-[34px] items-center"
    >
      <div
        ref={scrollViewportRef}
        className="absolute right-0 top-1/2 z-20 w-[34px] -translate-y-1/2 overflow-x-hidden overflow-y-auto [&::-webkit-scrollbar]:hidden"
        style={{
          height: `min(${navigatorContentHeight}px, calc(100% - ${NAVIGATOR_SAFE_GAP}px))`,
        }}
      >
        <div
          className="relative min-h-full w-full"
          style={{height: `${navigatorVirtualizer.getTotalSize()}px`}}
        >
          {navigatorVirtualizer.getVirtualItems().map(virtualItem => {
            const index = virtualItem.index;
            const item = items[index];
            if (!item) return null;
            const rawMessageText = item.user?.text;
            const messageText = rawMessageText?.trim()
              ? rawMessageText
              : undefined;
            const fallbackLabel = t.jumpToMessage({ index: index + 1 }).value;
            const accessibleLabel = messageText || fallbackLabel;
            const indicatorScale = getIndicatorScale(
              index,
              interactionIndex,
              item.id === resolvedActiveMessageId,
            );

            return (
              <Tooltip key={virtualItem.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => scrollToMessage(item.id, index)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    aria-label={accessibleLabel}
                    aria-current={
                      item.id === resolvedActiveMessageId ? "location" : undefined
                    }
                    className="group absolute left-0 top-0 flex h-2 w-full cursor-pointer items-center justify-end pr-1 focus-visible:outline-none"
                    style={{transform: `translateY(${virtualItem.start}px)`}}
                  >
                    <span
                      aria-hidden="true"
                      style={{ transform: `scaleX(${indicatorScale})` }}
                      className={cn(
                        "h-0.5 w-2 origin-right rounded transition-[transform,background-color] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                        "group-focus-visible:ring-1 group-focus-visible:ring-ring group-focus-visible:ring-offset-1",
                        "motion-reduce:transition-none",
                        interactionIndex !== null &&
                          Math.abs(index - interactionIndex) <
                            NAVIGATOR_INTERACTION_SCALES.length &&
                          "will-change-transform",
                        item.loading ||
                          item.status === ConversationMessageStatus.PENDING
                          ? "bg-info"
                          : item.status === ConversationMessageStatus.QUEUED
                            ? "bg-warning"
                          : item.status === ConversationMessageStatus.ERROR
                            ? "bg-destructive"
                            : item.status === ConversationMessageStatus.CANCELLED
                              ? "bg-muted-foreground/20"
                            : item.id === resolvedActiveMessageId
                              ? "bg-brand-action"
                              : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60 group-focus-visible:bg-muted-foreground/60",
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={8}
                  collisionPadding={16}
                  className="max-w-[min(320px,calc(100vw-2rem))] p-0 text-left"
                >
                  <div
                    className="max-w-full overflow-hidden whitespace-pre-wrap break-words px-3 py-1.5 leading-4 [overflow-wrap:anywhere]"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                    }}
                  >
                    {messageText || fallbackLabel}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
