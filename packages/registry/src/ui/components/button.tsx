import * as React from "react"
import {Slot} from "@radix-ui/react-slot"
import {cva, type VariantProps} from "class-variance-authority"

import {cn} from "../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:bg-transparent disabled:text-muted-foreground disabled:border-border disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] aria-invalid:ring-destructive aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed",
        brand: "bg-brand-action text-brand-action-foreground hover:bg-brand-action-hover active:bg-brand-action-pressed",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-pressed focus-visible:ring-destructive",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent active:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted active:bg-accent",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-brand-action underline-offset-4 hover:underline",
      },
      size: {
        // 移除 has-[>svg]:px-* 条件，统一 padding。
        // Chromium <105 不支持 :has() 时 padding 会保持初始值，导致图标按钮图标离边过远。
        // 改为统一较小 padding，依赖 gap-* 控制图标与文字间距，所有浏览器表现一致。
        default: "h-9 px-3 py-2",
        sm: "h-8 rounded-md gap-1.5 px-2.5",
        lg: "h-10 rounded-md px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
                  className,
                  variant,
                  size,
                  asChild = false,
                  ...props
                }: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({variant, size, className}))}
      {...props}
    />
  )
}

export {Button, buttonVariants}
