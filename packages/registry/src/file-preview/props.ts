import type {FileKindOrAuto, FileSource, PreviewerDefinition, ToolbarConfig} from './types'

export interface FilePreviewProps {
  /** 文件源：URL 字符串 / URL 对象（带 headers）/ 二进制对象 */
  src: FileSource
  /** 文件名（用于推断格式和展示） */
  fileName?: string
  /** 强制指定文件类别，默认 'auto' 自动识别 */
  fileKind?: FileKindOrAuto
  /** MIME 类型（用于辅助识别） */
  mimeType?: string
  /** URL 请求缓存策略。手动刷新可传入 `no-store` 强制读取最新内容。 */
  requestCache?: RequestCache
  /** 工具栏配置 */
  toolbar?: Partial<ToolbarConfig>
  /** 当前预览实例的自定义预览器，可覆盖内置格式处理 */
  previewers?: readonly PreviewerDefinition[]
  /** 工具栏外部容器。传入后，工具栏渲染到该容器而非预览底部。 */
  toolbarContainer?: HTMLElement | null
  /** 全屏时应包含预览内容与工具栏的目标元素。 */
  fullscreenTarget?: HTMLElement | null
  /** 错误回调 */
  onError?: (error: Error) => void
  /** 自定义下载回调（不传则使用内置下载） */
  onDownload?: (src: FileSource) => void
  /** 自定义外层 className */
  className?: string
}

