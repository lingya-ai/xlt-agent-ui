"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { ArrowDownIcon, Loader2 } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { Button } from "../../ui/components/button";
import { cn } from "../../ui/lib/utils";

import type { ChatItem } from "../hooks/use-chat/types";
import { MessageNavigator } from "./message-navigator";
import { STICK_TO_BOTTOM_THRESHOLD } from "./message-scroll-anchor";

const ESTIMATED_MESSAGE_HEIGHT = 240;
const MESSAGE_GAP = 32;
const MESSAGE_OVERSCAN = 3;
const LOAD_OLDER_THRESHOLD = 2;
// 与模式切换和局部折叠共用末端判定，避免不同操作产生滚动跳变。

interface VirtualizedMessageListProps {
  items: ChatItem[];
  className?: string;
  contentClassName?: string;
  hasOlderMessages?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlderMessages?: () => void;
  showMessageNavigator: boolean;
  renderItem: (item: ChatItem) => ReactNode;
}

function findLastVisibleItem(
  virtualItems: VirtualItem[],
  scrollOffset: number,
  viewportHeight: number,
): VirtualItem | undefined {
  const viewportEnd = scrollOffset + viewportHeight;
  let lastVisible: VirtualItem | undefined;

  for (const item of virtualItems) {
    if (item.end <= scrollOffset || item.start >= viewportEnd) continue;
    lastVisible = item;
  }

  return lastVisible;
}

/**
 * 面向动态高度聊天消息的虚拟滚动容器。
 *
 * TanStack Virtual 负责行测量、历史前插锚定和末端跟随；所有程序化远距离定位均使用瞬时滚动，
 * 避免平滑滚动沿途挂载并加载大量历史消息。
 */
export function VirtualizedMessageList({
  items,
  className,
  contentClassName,
  hasOlderMessages = false,
  isLoadingOlder = false,
  onLoadOlderMessages,
  showMessageNavigator,
  renderItem,
}: VirtualizedMessageListProps) {
  const t = useAgentMessages("agents-chat-message");
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const initialScrollCompletedRef = useRef(false);
  const secondNavigationFrameRef = useRef<number | undefined>(undefined);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollViewportRef.current,
    getItemKey: (index) => items[index]?.id ?? index,
    estimateSize: () => ESTIMATED_MESSAGE_HEIGHT,
    gap: MESSAGE_GAP,
    overscan: MESSAGE_OVERSCAN,
    initialOffset: () => Number.MAX_SAFE_INTEGER,
    anchorTo: "end",
    followOnAppend: "auto",
    scrollEndThreshold: STICK_TO_BOTTOM_THRESHOLD,
    // React 19 提交布局副作用期间禁止嵌套 flushSync；普通状态更新仍会在当前提交后刷新虚拟窗口。
    useFlushSync: false,
    // Chromium 102 不支持 scrollend，保持基于定时器的兼容实现。
    useScrollendEvent: false,
    onChange: (instance) => {
      setIsAtBottom(instance.isAtEnd(STICK_TO_BOTTOM_THRESHOLD));
    },
  });
  const virtualItems = virtualizer.getVirtualItems();
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const viewportHeight = virtualizer.scrollRect?.height ?? 0;
  const lastVisibleItem = findLastVisibleItem(
    virtualItems,
    scrollOffset,
    viewportHeight,
  );
  const activeMessageId = lastVisibleItem
    ? items[lastVisibleItem.index]?.id
    : undefined;
  const firstVisibleIndex = virtualItems.find(
    (item) => item.end > scrollOffset,
  )?.index;

  useLayoutEffect(() => {
    if (items.length === 0 || initialScrollCompletedRef.current) return;
    virtualizer.scrollToEnd({ behavior: "auto" });
    initialScrollCompletedRef.current = true;
    setIsAtBottom(true);
  }, [items.length, virtualizer]);

  useEffect(() => {
    if (
      !initialScrollCompletedRef.current ||
      firstVisibleIndex === undefined ||
      firstVisibleIndex > LOAD_OLDER_THRESHOLD ||
      !hasOlderMessages ||
      isLoadingOlder
    ) {
      return;
    }

    onLoadOlderMessages?.();
  }, [
    firstVisibleIndex,
    hasOlderMessages,
    isLoadingOlder,
    onLoadOlderMessages,
  ]);

  useEffect(
    () => () => {
      if (secondNavigationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(secondNavigationFrameRef.current);
      }
    },
    [],
  );

  const handleScrollToBottom = useCallback(() => {
    virtualizer.scrollToEnd({ behavior: "auto" });
  }, [virtualizer]);

  const handleNavigate = useCallback(
    (messageId: string, index: number) => {
      const resolvedIndex =
        items[index]?.id === messageId
          ? index
          : items.findIndex((item) => item.id === messageId);
      if (resolvedIndex < 0) return;

      virtualizer.scrollToIndex(resolvedIndex, {
        align: "start",
        behavior: "auto",
      });
      if (secondNavigationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(secondNavigationFrameRef.current);
      }
      secondNavigationFrameRef.current = window.requestAnimationFrame(() => {
        virtualizer.scrollToIndex(resolvedIndex, {
          align: "start",
          behavior: "auto",
        });
        secondNavigationFrameRef.current = undefined;
      });
    },
    [items, virtualizer],
  );

  return (
    <div
      className={cn(
        "relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden",
        className,
      )}
      data-chat-container
    >
      <div
        ref={scrollViewportRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto"
      >
        <div data-chat-scroll className={cn("min-w-0 p-4", contentClassName)}>
          <div
            data-chat-message-list
            className="relative mx-auto w-full max-w-3xl"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualItems.map((virtualItem) => {
              const item = items[virtualItem.index];
              if (!item) return null;

              return (
                <div
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  data-message-id={item.id}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  {renderItem(item)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isLoadingOlder && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isAtBottom && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
          aria-label={t.scrollToBottom.value}
          onClick={handleScrollToBottom}
        >
          <ArrowDownIcon />
        </Button>
      )}

      {showMessageNavigator && (
        <MessageNavigator
          items={items}
          activeMessageId={activeMessageId}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}
