"use client"

import {type ComponentProps, memo, useMemo} from "react"
import {Streamdown} from "streamdown"
import {code} from "@streamdown/code"
import {mermaid} from "@streamdown/mermaid"
import {math} from "@streamdown/math"
import {cjk} from "@streamdown/cjk"
import {cn} from "../../ui/lib/utils"
import {rehypeKnowledgeCitation} from "../lib/rehype-knowledge-citation"
import {KnowledgeCitationBadge} from "./knowledge-citation-badge"

export type CitationMessageResponseProps = ComponentProps<typeof Streamdown>

/**
 * 自定义 span 渲染：检测 km-citation 类名后渲染引用徽章
 *
 * rehype 插件直接在 hast 层设置 properties，
 * Streamdown 会将其作为 React props 传递给自定义组件。
 */
function CitationSpan(props: React.ComponentProps<"span"> & { node?: unknown }) {
  const {className, node: _, ...rest} = props

  if (className === "km-citation" && "data-keys" in rest) {
    return (
      <KnowledgeCitationBadge
        dataKeys={(rest as Record<string, unknown>)["data-keys"] as string}
      />
    )
  }

  return <span className={className} {...rest}/>
}

/**
 * 引用消息响应组件
 *
 * 封装 MessageResponse，注入 rehypeKnowledgeCitation 插件
 * 和自定义 span → CitationSpan 组件映射。
 *
 * @author 思追(shaco)
 */
export const CitationMessageResponse: React.MemoExoticComponent<
  (props: CitationMessageResponseProps) => React.ReactElement
> = memo(
  function CitationMessageResponse({
                                     className,
                                     ...props
                                   }: CitationMessageResponseProps) {
    const rehypePlugins = useMemo(
      () => [rehypeKnowledgeCitation],
      []
    )

    const components = useMemo(
      () => ({span: CitationSpan}),
      []
    )

    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        plugins={{code, mermaid, math, cjk}}
        rehypePlugins={rehypePlugins}
        components={components}
        {...props}
      />
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)
