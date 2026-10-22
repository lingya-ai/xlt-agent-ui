"use client"

import {Loader2Icon} from "lucide-react"
import {useAgentMessages} from "../../i18n/runtime"

import {cn} from "../lib/utils"

function Spinner({className, ...props}: React.ComponentProps<"svg">) {
  const t = useAgentMessages("spinner")
  return (
    <Loader2Icon
      role="status"
      aria-label={t.loading.value}
      // motion-reduce:animate-none —— apps/portal/PRODUCT.md 要求「所有动效提供
      // prefers-reduced-motion 降级」。旋转是纯装饰，停止后仍由 role="status" 与
      // aria-label 表达加载中，因此可以直接停掉而不是替换成别的动效。
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export {Spinner}
