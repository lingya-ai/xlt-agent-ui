"use client"

import React, {useCallback, useState} from "react"
import {Download, ImageOff, Maximize2} from "lucide-react"
import {useFileBlobUrlRequest, useFilePreviewUrlCallback} from "../hooks/use-chat/use-file-preview-url-callback"
import {useAiChatContext} from "./context"
import {FilePreviewSheet} from "./file-preview-sheet"
import {useAgentMessages} from "../../i18n/runtime";

/**
 * 文生图结果预览组件
 * 根据文件 ID 获取预签名 URL 并展示图片，点击打开 FilePreviewSheet 全功能预览
 */
export function TextToImagePreview({fileId}: { fileId: number }) {
  const {conversationId, httpClient} = useAiChatContext()

  if (!conversationId) return null

  return (
    <TextToImagePreviewContent
      conversationId={conversationId}
      fileId={fileId}
      httpClient={httpClient}
    />
  )
}

function TextToImagePreviewContent({
  conversationId,
  fileId,
  httpClient,
}: {
  conversationId: string
  fileId: number
  httpClient: ReturnType<typeof useAiChatContext>["httpClient"]
}) {
  const t = useAgentMessages("text-to-image-preview");
  const [sheetOpen, setSheetOpen] = useState(false)
  const filePreviewUrlCallback = useFilePreviewUrlCallback(httpClient, conversationId);

  const {
    data: imageUrl,
    loading,
    error,
  } = useFileBlobUrlRequest(httpClient, conversationId, fileId)

  const handleDownload = useCallback(async (event?: React.MouseEvent) => {
    event?.stopPropagation()
    const {url: imageUrl} = await filePreviewUrlCallback(fileId)
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `image-${fileId}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch {
      // 下载失败时回退到新窗口打开
      window.open(imageUrl, "_blank")
    }
  }, [filePreviewUrlCallback, fileId])

  const openSheet = useCallback(() => setSheetOpen(true), [])

  if (error) {
    return (
      <div className="p-4">
        <div className="size-full min-h-[120px] flex flex-col items-center justify-center bg-muted/50 rounded-md gap-2">
          <ImageOff size={20} className="text-muted-foreground"/>
          <span className="text-xs text-muted-foreground">{t.imageLoadError}</span>
        </div>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="p-4">
        <div className="size-full min-h-[120px] flex items-center justify-center bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground">{t.loading}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="group relative inline-block">
        <img
          src={imageUrl}
          alt="Generated"
          className="h-auto max-w-full overflow-hidden rounded-md cursor-pointer"
          loading="lazy"
          onClick={openSheet}
        />
        {/* 操作栏 */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="size-7 flex items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
            onClick={openSheet}
            title={t.fullscreenImage.value}
          >
            <Maximize2 size={14}/>
          </button>
          <button
            type="button"
            className="size-7 flex items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
            onClick={handleDownload}
            title={t.downloadImage.value}
          >
            <Download size={14}/>
          </button>
        </div>
      </div>

      <FilePreviewSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        fileId={fileId}
        fileName={`image-${fileId}.png`}
        mimeType="image/png"
      />
    </div>
  )
}
