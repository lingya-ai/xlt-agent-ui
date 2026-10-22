"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import {CheckIcon, MinusIcon} from "lucide-react"

import {cn} from "../lib/utils"

function Checkbox({
                    className,
                    ...props
                  }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer border-input dark:data-[state=unchecked]:bg-input/30 data-[state=checked]:bg-control-active data-[state=checked]:text-control-active-foreground data-[state=checked]:border-control-active data-[state=indeterminate]:bg-control-active data-[state=indeterminate]:text-control-active-foreground data-[state=indeterminate]:border-control-active focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden"/>
        <MinusIcon className="hidden size-3.5 group-data-[state=indeterminate]:block"/>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export {Checkbox}
