/**
 * 知识库引用标记解析工具
 *
 * 提供引用标记的正则表达式和文本拆分逻辑，
 * 供 rehype 插件、remark 插件、citation context 共同使用。
 *
 * @author 思追(shaco)
 */

/** 匹配单个 [type:id] 引用标记 */
export const CITATION_RE = /\[(chunk|entity|community|claim):(\d+)]/g

export type CitationSplitPart =
  | {kind: "text"; value: string}
  | {kind: "citation"; keys: string[]}

/**
 * 将文本拆分为 text 和 citation 片段
 *
 * 连续的 [type:id]（无文本间隔）合并为单个 citation，
 * 例如 `...方案[chunk:1][chunk:2]后续` → `[text, citation([1,2]), text]`。
 *
 * @param text 待拆分文本
 * @returns 拆分结果数组
 */
export function splitCitationText(text: string): CitationSplitPart[] {
  const parts: CitationSplitPart[] = []
  let lastIndex = 0
  let pendingKeys: string[] = []

  CITATION_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = CITATION_RE.exec(text)) !== null) {
    const between = text.slice(lastIndex, match.index)
    if (between.length > 0) {
      if (pendingKeys.length > 0) {
        parts.push({kind: "citation", keys: pendingKeys})
        pendingKeys = []
      }
      parts.push({kind: "text", value: between})
    }

    pendingKeys.push(`${match[1]}:${match[2]}`)
    lastIndex = CITATION_RE.lastIndex
  }

  if (pendingKeys.length > 0) {
    parts.push({kind: "citation", keys: pendingKeys})
  }

  const remaining = text.slice(lastIndex)
  if (remaining.length > 0) {
    parts.push({kind: "text", value: remaining})
  }

  return parts
}
