'use client'
import type {FileKind} from '../types'

/** 文本类代码扩展名（走 shiki 高亮） */
export const CODE_EXTENSIONS = [
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'json', 'json5', 'jsonc',
  'css', 'scss', 'sass', 'less', 'stylus',
  'vue', 'svelte', 'astro',
  'py', 'rb', 'php', 'java', 'kotlin', 'kt', 'swift',
  'go', 'rust', 'rs', 'c', 'cpp', 'cc', 'h', 'hpp',
  'cs', 'scala', 'dart', 'lua', 'r', 'sql',
  'yaml', 'yml', 'toml', 'ini', 'conf', 'env',
  'sh', 'bash', 'zsh', 'fish', 'ps1',
  'dockerfile',
  'gitignore', 'gitattributes',
  'xml', 'svg',
] as const

/** 文本类（无高亮）扩展名 */
export const TEXT_EXTENSIONS = [
  'txt', 'log', 'md', 'markdown', 'csv', 'tsv',
] as const

/** Markdown 优先识别（覆盖 TEXT_EXTENSIONS 中的 md） */
export const MARKDOWN_EXTENSIONS = ['md', 'markdown'] as const

/** HTML 页面扩展名（使用沙箱 iframe 渲染） */
export const HTML_EXTENSIONS = ['html', 'htm'] as const

/** 图片扩展名 */
export const IMAGE_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif',
] as const

/** PDF 扩展名 */
export const PDF_EXTENSIONS = ['pdf'] as const

/** PowerPoint 扩展名（仅支持 OOXML 格式） */
export const PPTX_EXTENSIONS = ['pptx'] as const

/** Word 扩展名（仅 docx 可预览） */
export const DOCX_EXTENSIONS = ['docx'] as const

/** Excel 扩展名 */
export const EXCEL_EXTENSIONS = ['xlsx', 'xls'] as const

/** 视频扩展名 */
export const VIDEO_EXTENSIONS = [
  'mp4', 'webm', 'ogv', 'mov', 'm4v',
] as const

/** 音频扩展名 */
export const AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'ogg', 'oga', 'flac', 'aac', 'm4a',
] as const

/** MIME 类型 → FileKind 映射 */
export const MIME_TO_KIND: Record<string, FileKind> = {
  'application/pdf': 'pdf',

  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',

  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',

  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/x-icon': 'image',
  'image/avif': 'image',

  'text/plain': 'text',
  'text/csv': 'text',
  'text/markdown': 'markdown',
  'text/html': 'html',
  'application/xhtml+xml': 'html',

  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',

  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
}

/** 默认工具栏配置 */
export const DEFAULT_TOOLBAR_CONFIG = {
  zoom: true,
  download: true,
  fullscreen: true,
  rotate: true,
} as const
