'use client'

import {useCallback, useEffect, useRef, useState} from 'react'
import {FileText, Loader2, X} from 'lucide-react'
import {useAgentMessages} from '../../i18n/runtime'
import {Button} from '../../ui/components/button'
import {cn} from '../../ui/lib/utils'
import {Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle,} from '../../ui/components/sheet'
import {OptionalFilePreview as FilePreview} from '../../integration/media'
import type {FileSource, PreviewerDefinition} from '../../file-preview/types'
import {downloadFile} from '../../file-preview/utils/download-file'
import {useAiChatContext} from './context'
import {useWorkspaceFilePreviewUrlCallback} from '../hooks/use-chat/use-workspace-file-preview-url'
import {useFilePreviewUrlCallback} from '../hooks/use-chat/use-file-preview-url-callback'

export interface FilePreviewLoadOptions {
  /** 手动刷新时禁止浏览器从 HTTP 缓存中读取预签名地址和文件内容。 */
  cache?: RequestCache
}

/** 返回最新文件源，预览和每次下载都会重新调用。 */
export type FilePreviewSourceLoader = (options?: FilePreviewLoadOptions) => Promise<FileSource>

export interface FilePreviewSheetProps {
  /** 是否展开 */
  open: boolean
  /** 展开状态变更回调 */
  onOpenChange: (open: boolean) => void
  /** 模式 A：通过 agents 文件接口的 fileId 获取预签名 URL（默认） */
  fileId?: number
  /** 文件所属会话。历史消息预览应显式传入，未传时回退到聊天上下文。 */
  conversationId?: string
  /** 模式 B：自定义文件源加载函数（用于 workspace 文件等无 fileId 场景） */
  loadFileSource?: FilePreviewSourceLoader
  /** 文件名（用于格式识别和展示，建议传入） */
  fileName?: string
  /** MIME 类型（辅助识别） */
  mimeType?: string
  /** 侧边栏宽度 class，覆盖默认（按文件类型推断） */
  widthClassName?: string
  /** 当前预览实例的自定义预览器。 */
  previewers?: readonly PreviewerDefinition[]
  /** 预览源未变化但需要强制刷新时递增。 */
  loadKey?: string | number
}

/**
 * 文件预览侧边栏
 *
 * 受控组件：由父组件管理 open 状态和 fileId。当 open 且 fileId 有效时，
 * 通过 useFilePreviewUrlCallback 获取预签名 URL；预览和下载都会分别获取最新文件源。
 * Sheet 宽度可通过 widthClassName 覆盖。
 *
 * @example
 * <FilePreviewSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   fileId={selectedFileId}
 *   fileName={selectedFileName}
 * />
 */
export function FilePreviewSheet(
  {
    open,
    onOpenChange,
    fileId,
    conversationId: explicitConversationId,
    loadFileSource,
    fileName,
    mimeType,
    widthClassName,
    previewers,
    loadKey,
  }: FilePreviewSheetProps) {
  const t = useAgentMessages('file-preview-sheet')
  const {conversationId: contextConversationId} = useAiChatContext()
  const conversationId = explicitConversationId ?? contextConversationId

  const hasSource = Boolean(loadFileSource) || Boolean(fileId && conversationId)
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null)
  const [sheetContent, setSheetContent] = useState<HTMLDivElement | null>(null)

  const setToolbarContainerRef = useCallback((node: HTMLDivElement | null) => {
    setToolbarContainer(node)
  }, [])
  const setSheetContentRef = useCallback((node: HTMLDivElement | null) => {
    setSheetContent(node)
  }, [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={setSheetContentRef}
        side="right"
        showClose={false}
        className={cn('flex w-full max-w-none flex-col gap-0 p-0 sm:w-[90vw] sm:max-w-[90vw] lg:w-[50vw] lg:min-w-[800px]', widthClassName)}
      >
        <SheetHeader className="border-b border-border/60 px-3 py-3 text-left sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-brand">
                <FileText size={14}/>
              </span>
              <div className="flex min-w-0 flex-col leading-tight">
                <SheetTitle className="truncate text-sm font-medium text-foreground">
                  {fileName ?? t.title}
                </SheetTitle>
                <span className="truncate text-[11px] text-muted-foreground">{t.subtitle}</span>
              </div>
            </div>
            <div className="flex min-w-0 shrink items-center gap-1">
              <div ref={setToolbarContainerRef} className="min-w-0 overflow-x-auto"/>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="size-10 shrink-0 sm:size-7" aria-label={t.close.value}>
                  <X data-icon="inline-start" className="size-4"/>
                  <span className="sr-only">{t.close}</span>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          {open && hasSource ? (
            <FilePreviewContent
              fileId={fileId}
              conversationId={conversationId}
              loadFileSource={loadFileSource}
              fileName={fileName}
              mimeType={mimeType}
              previewers={previewers}
              toolbarContainer={toolbarContainer}
              fullscreenTarget={sheetContent}
              loadKey={loadKey}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {t.noFile}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export interface FilePreviewContentProps {
  /** 工作区文件使用当前路径，消息文件优先使用版本 ID。 */
  relativePath?: string
  fileId?: number
  /** 文件所属会话。历史消息预览应显式传入，未传时回退到聊天上下文。 */
  conversationId?: string
  /** 每次调用均返回当前可用于预览或下载的文件源。 */
  loadFileSource?: FilePreviewSourceLoader
  fileName?: string
  mimeType?: string
  /** 当前预览实例的自定义预览器。 */
  previewers?: readonly PreviewerDefinition[]
  /** 工具栏外部容器。 */
  toolbarContainer?: HTMLElement | null
  /** 全屏时的目标元素。 */
  fullscreenTarget?: HTMLElement | null
  /** 预览源未变化但需要手动强制刷新时递增。 */
  loadKey?: string | number
}

/**
 * Sheet 主体：仅在 open 且源有效时挂载。
 *
 * 文件 ID 预览必须携带非空会话 ID；工作区文件则使用调用方提供的文件源加载函数。
 */
export function FilePreviewContent(props: FilePreviewContentProps) {
  const {conversationId: contextConversationId} = useAiChatContext()
  const conversationId = props.conversationId ?? contextConversationId

  if (props.loadFileSource) {
    return <FilePreviewLoader {...props} loadFileSource={props.loadFileSource}/>
  }

  if (!props.fileId && props.relativePath && conversationId) {
    return <WorkspacePathPreviewContent {...props} conversationId={conversationId} relativePath={props.relativePath}/>
  }
  if (!props.fileId || !conversationId) return null

  return <ConversationFilePreviewContent {...props} conversationId={conversationId} fileId={props.fileId}/>
}

function WorkspacePathPreviewContent({conversationId,relativePath,...props}:FilePreviewContentProps & {conversationId:string;relativePath:string}) {
 const {httpClient}=useAiChatContext()
 const fetchUrl=useWorkspaceFilePreviewUrlCallback({httpClient})
 const loadFileSource=useCallback(async ():Promise<FileSource> => {
  const {url}=await fetchUrl(conversationId,relativePath)
  return {url}
 },[fetchUrl,conversationId,relativePath])
 return <FilePreviewLoader {...props} loadFileSource={loadFileSource}/>
}

function ConversationFilePreviewContent({
  conversationId,
  fileId,
  ...props
}: FilePreviewContentProps & {conversationId: string; fileId: number}) {
  const {httpClient} = useAiChatContext()
  const fetchPreviewUrl = useFilePreviewUrlCallback(httpClient, conversationId)
  const loadFileSource = useCallback(async (options?: FilePreviewLoadOptions): Promise<FileSource> => {
    const {url} = await fetchPreviewUrl(fileId, options)
    return {url}
  }, [fetchPreviewUrl, fileId])

  return <FilePreviewLoader {...props} loadFileSource={loadFileSource}/>
}

function FilePreviewLoader({
  loadFileSource,
  fileName,
  mimeType,
  previewers,
  toolbarContainer,
  fullscreenTarget,
  loadKey,
}: Omit<FilePreviewContentProps, "fileId"> & {loadFileSource: FilePreviewSourceLoader}) {
  const t = useAgentMessages('file-preview-sheet')
  const previousLoadKeyRef = useRef(loadKey)
  const [state, setState] = useState<{
    source?: FileSource
    loading: boolean
    error?: Error
    requestCache?: RequestCache
  }>({loading: true})

  useEffect(() => {
    let cancelled = false
    const isManualRefresh = previousLoadKeyRef.current !== loadKey
    previousLoadKeyRef.current = loadKey
    const requestCache = isManualRefresh ? 'no-store' : undefined

    setState((current) => ({...current, error: undefined, loading: true}))

    loadFileSource({cache: requestCache})
      .then((source) => {
        if (cancelled) return
        setState({source, loading: false, requestCache})
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState((current) => ({
          source: current.source,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
          requestCache: current.requestCache,
        }))
      })

    return () => {
      cancelled = true
    }
  }, [loadFileSource, loadKey])

  const handleDownload = useCallback(() => {
    void loadFileSource()
      .then((source) => downloadFile(source, fileName))
      .catch((error: unknown) => {
        console.error('[FilePreviewSheet] 文件下载失败', error)
      })
  }, [fileName, loadFileSource])

  if (state.loading && !state.source) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 size-3.5 animate-spin"/>
        {t.title}
      </div>
    )
  }

  if (state.error && !state.source) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-destructive">
        {t.loadError}
      </div>
    )
  }

  if (!state.source) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-destructive">
        {t.loadError}
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <FilePreview
        src={state.source}
        requestCache={state.requestCache}
        fileName={fileName}
        mimeType={mimeType}
        previewers={previewers}
        toolbarContainer={toolbarContainer}
        fullscreenTarget={fullscreenTarget}
        onDownload={handleDownload}
        className="h-full"
      />
      {state.error && (
        <div
          role="alert"
          className="absolute right-3 top-3 flex items-center rounded-md border border-destructive/50 bg-background px-2 py-1 text-xs text-destructive shadow-sm"
        >
          {t.loadError}
        </div>
      )}
      {state.loading && (
        <div
          className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="size-3 animate-spin"/>
          {t.title}
        </div>
      )}
    </div>
  )
}
