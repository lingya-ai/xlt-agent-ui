import * as React from "react"
import {Slot} from "@radix-ui/react-slot"
import {cva, type VariantProps} from "class-variance-authority"

import {cn} from "../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] aria-invalid:ring-destructive aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-muted",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-muted",
        destructive:
          "border-destructive/40 bg-destructive-soft text-destructive [a&]:hover:bg-accent focus-visible:ring-destructive",
        brand:
          "border-primary-border bg-primary-soft text-primary [a&]:hover:bg-primary-soft-hover",
        success:
          "border-success/40 bg-success-soft text-success [a&]:hover:bg-accent",
        warning:
          "border-warning/40 bg-warning-soft text-warning [a&]:hover:bg-accent",
        info:
          "border-info/40 bg-info-soft text-info [a&]:hover:bg-accent",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
                 className,
                 variant,
                 asChild = false,
                 ...props
               }: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({variant}), className)}
      {...props}
    />
  )
}

export {Badge, badgeVariants}
