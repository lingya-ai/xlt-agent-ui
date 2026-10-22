'use client'

import type {FileKind} from '../types'
import {
  AUDIO_EXTENSIONS,
  CODE_EXTENSIONS,
  DOCX_EXTENSIONS,
  EXCEL_EXTENSIONS,
  HTML_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MARKDOWN_EXTENSIONS,
  PDF_EXTENSIONS,
  PPTX_EXTENSIONS,
  TEXT_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from './file-type'

/**
 * @file 扩展名 → FileKind 映射表（由常量聚合而成）
 */
const buildMap = <T extends string>(
  exts: readonly T[],
  kind: FileKind,
): Record<string, FileKind> =>
  exts.reduce<Record<string, FileKind>>((acc, ext) => {
    acc[ext] = kind
    return acc
  }, {})

/** 扩展名 → FileKind 映射 */
export const EXTENSION_TO_KIND: Record<string, FileKind> = {
  ...buildMap(PDF_EXTENSIONS, 'pdf'),
  ...buildMap(PPTX_EXTENSIONS, 'pptx'),
  ...buildMap(DOCX_EXTENSIONS, 'docx'),
  ...buildMap(EXCEL_EXTENSIONS, 'excel'),
  ...buildMap(IMAGE_EXTENSIONS, 'image'),
  ...buildMap(VIDEO_EXTENSIONS, 'video'),
  ...buildMap(AUDIO_EXTENSIONS, 'audio'),
  // Markdown 优先于 text
  ...buildMap(MARKDOWN_EXTENSIONS, 'markdown'),
  ...buildMap(HTML_EXTENSIONS, 'html'),
  // 代码高亮
  ...buildMap(CODE_EXTENSIONS, 'code'),
  // 纯文本兜底（不含 md，已被 markdown 覆盖）
  ...buildMap(TEXT_EXTENSIONS.filter((ext) => !MARKDOWN_EXTENSIONS.includes(ext as never)), 'text'),
}
