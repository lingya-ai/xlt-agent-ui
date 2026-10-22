'use client'

import type {ComponentType} from 'react'

/**
 * 文件类别枚举
 * - pdf: PDF 文档
 * - pptx: PowerPoint 演示文稿 (.pptx)
 * - docx: Word 文档 (.docx)
 * - excel: Excel 表格 (.xlsx/.xls)
 * - image: 图片
 * - text: 纯文本
 * - code: 代码（含语法高亮）
 * - markdown: Markdown
 * - html: HTML 页面（安全沙箱渲染）
 * - video: 视频
 * - audio: 音频
 * - unsupported: 不支持的格式（提供下载）
 */
export type FileKind =
  | 'pdf'
  | 'pptx'
  | 'docx'
  | 'excel'
  | 'image'
  | 'text'
  | 'code'
  | 'markdown'
  | 'html'
  | 'video'
  | 'audio'
  | 'unsupported'

/**
 * 可预览文件类别。
 *
 * 除内置 FileKind 外，外部调用方可通过 FilePreview 的 previewers 入参声明任意字符串类别。
 * 'auto' 为 FilePreview 的保留值，不应作为自定义类别注册。
 */
export type PreviewerKind = FileKind | (string & {})

/** 自动识别标识，配合 FilePreview 的 fileKind="auto" 使用 */
export type FileKindOrAuto = PreviewerKind | 'auto'

/** URL 形式文件源（可携带鉴权头） */
export interface FileSourceUrl {
  url: string
  headers?: HeadersInit
  /** 是否需要带 cookie，默认 false */
  withCredentials?: boolean
}

/** 二进制形式文件源（已加载到内存的文件） */
export interface FileSourceBuffer {
  data: ArrayBuffer | Blob
  /** 文件名，用于推断格式 */
  name?: string
  /** MIME 类型，用于推断格式 */
  mimeType?: string
}

/** 文件源：URL 字符串 / URL 对象 / 二进制对象 */
export type FileSource = string | FileSourceUrl | FileSourceBuffer

/** 工具栏配置 */
export interface ToolbarConfig {
  /** 显示缩放控制（PDF/图片等） */
  zoom: boolean
  /** 显示下载按钮 */
  download: boolean
  /** 显示全屏按钮 */
  fullscreen: boolean
  /** 显示旋转按钮（图片） */
  rotate: boolean
}

/** 预览通用配置 */
export interface PreviewConfig {
  /** 初始缩放，1 = 100% */
  initialZoom?: number
  /** 是否显示工具栏 */
  toolbar?: Partial<ToolbarConfig>
  /** 自定义不支持的格式提示 */
  unsupportedMessage?: string
}

/** 各预览器统一接收的 props */
export interface PreviewerProps {
  /** 已加载到内存的二进制数据 */
  source: ArrayBuffer
  /** 文件名 */
  fileName?: string
  /** MIME 类型 */
  mimeType?: string
  /** 配置项 */
  config: PreviewConfig
  /** 下载回调（由父级注入） */
  onDownload?: () => void
  /** 错误回调 */
  onError?: (error: Error) => void
  /** 自定义 className */
  className?: string
}

/** 预览器组件类型 */
export type PreviewerComponent = ComponentType<PreviewerProps>

/** 预览器定义（用于 FilePreview 的 previewers 入参或注册表） */
export interface PreviewerDefinition {
  /** 对应的文件类别 */
  kind: PreviewerKind
  /** 支持的文件扩展名（小写、不含点） */
  extensions: string[]
  /** 支持的 MIME 类型 */
  mimeTypes: string[]
  /** 预览器组件 */
  Component: PreviewerComponent
}

/** 加载状态 */
export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'
