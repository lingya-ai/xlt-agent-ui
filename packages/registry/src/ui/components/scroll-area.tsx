"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import {cn} from "../lib/utils"

interface ScrollAreaProps extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  /** 隐藏横向溢出，强制内容在视口内换行 */
  overflowXHidden?: boolean
  /** 启用横向滚动条；与 overflowXHidden 同时传入时不生效 */
  horizontalScrollbar?: boolean
}

function ScrollArea({
                      className,
                      children,
                      overflowXHidden,
                      horizontalScrollbar,
                      ...props
                    }: ScrollAreaProps) {
  const showHorizontalScrollbar = horizontalScrollbar && !overflowXHidden

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
          overflowXHidden && "[&>div]:block! min-w-0 overflow-x-hidden"
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar/>
      {showHorizontalScrollbar ? <ScrollBar orientation="horizontal"/> : null}
      <ScrollAreaPrimitive.Corner/>
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
                     className,
                     orientation = "vertical",
                     ...props
                   }: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export {ScrollArea, ScrollBar}
