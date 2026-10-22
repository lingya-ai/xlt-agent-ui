/* eslint-disable @typescript-eslint/no-explicit-any -- rehype 插件需要操作动态 AST 节点 */

import {CITATION_RE, splitCitationText} from "./citation-utils"

/**
 * rehype 插件：将 [type:id] 标记转为 <span class="km-citation" data-keys="..."> 元素
 *
 * 直接操作 hast 树，设置 element properties，绕过 remark→hast 属性丢失问题。
 */
export function rehypeKnowledgeCitation(): (tree: any) => void {
  return (tree: any) => {
    const visit = (node: any): void => {
      if (node.children && Array.isArray(node.children)) {
        const newChildren: any[] = []
        for (const child of node.children) {
          if (child?.type === "text" && typeof child.value === "string") {
            CITATION_RE.lastIndex = 0
            if (CITATION_RE.test(child.value)) {
              const parts = splitCitationText(child.value)
              for (const part of parts) {
                if (part.kind === "text") {
                  newChildren.push({type: "text", value: part.value})
                } else {
                  newChildren.push({
                    type: "element",
                    tagName: "span",
                    properties: {
                      className: "km-citation",
                      "data-keys": part.keys.join(","),
                    },
                    children: [],
                  })
                }
              }
            } else {
              newChildren.push(child)
            }
          } else {
            newChildren.push(child)
            if (child?.children) {
              visit(child)
            }
          }
        }
        node.children = newChildren
      }
    }

    visit(tree)
  }
}
