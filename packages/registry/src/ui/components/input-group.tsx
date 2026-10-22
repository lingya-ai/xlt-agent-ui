"use client"

import * as React from "react"
import {cva, type VariantProps} from "class-variance-authority"

import {cn} from "../lib/utils"
import {Button} from "./button"
import {Input} from "./input"
import {Textarea} from "./textarea"

function InputGroup({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group focus-within:ring-2 focus-within:ring-ring border-input dark:bg-input/30 relative flex w-full items-center rounded-md border shadow-xs transition-[color,box-shadow] outline-none",
        "h-9 min-w-0 ",

        // Variants based on alignment.
        "",
        "",
        "  ",
        "  ",

        // Focus state.
        //
        // 焦点环必须由外层提供：InputGroupInput / InputGroupTextarea 都显式设置了 focus-visible:ring-0，
        // 内部控件自己不显示环。
        // 因此这里**不能**依赖 :has()——Chromium 102（政企基线，已实测
        // CSS.supports('selector(:has(*))') === false）不解析它，结果是键盘焦点完全不可见（WCAG 2.4.7）。
        // focus-within 自 Chrome 60 起可用，语义上等价于「内部控件获得焦点」，
        // 且与多数调用点已自行补上的 focus-within:* 写法一致。
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",

        // Error state.
        "  ",

        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3  ",
        "inline-end":
          "order-last pr-3  ",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 ",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 ",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
                           className,
                           align = "inline-start",
                           ...props
                         }: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({align}), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "text-sm shadow-none flex gap-2 items-center",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 ",
        sm: "h-8 px-2.5 gap-1.5 rounded-md ",
        "icon-xs":
          "size-6 rounded-[calc(var(--radius)-5px)] p-0 ",
        "icon-sm": "size-8 p-0 ",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
                            className,
                            type = "button",
                            variant = "ghost",
                            size = "xs",
                            ...props
                          }: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({size}), className)}
      {...props}
    />
  )
}

function InputGroupText({className, ...props}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
                           className,
                           ...props
                         }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
                              className,
                              ref,
                              ...props
                            }: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      ref={ref}
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
