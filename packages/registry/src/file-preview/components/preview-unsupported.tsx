'use client'
import {Download, FileQuestion} from 'lucide-react'
import {useAgentMessages} from '../../i18n/runtime'
import {Button} from '../../ui/components/button'
import {cn} from '../../ui/lib/utils'

export interface PreviewUnsupportedProps {
  /** 文件名（用于展示） */
  fileName?: string
  /** 下载回调（不传则隐藏按钮） */
  onDownload?: () => void
  className?: string
  /** 是否在内容区显示下载按钮，默认显示。 */
  showInlineDownload?: boolean
}

/**
 * @file 不支持预览的文件占位（提供下载）
 */
export function PreviewUnsupported({
  fileName,
  onDownload,
  className,
  showInlineDownload = true,
}: PreviewUnsupportedProps) {
  const t = useAgentMessages('preview-unsupported')
  const description = fileName
    ? t.unsupportedDescription({fileName})
    : t.unsupportedDescriptionGeneric

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 w-full h-full',
        'bg-muted/30 text-muted-foreground p-6 text-center',
        className,
      )}
    >
      <FileQuestion className="size-12 opacity-50"/>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{t.unsupportedTitle}</p>
        <p className="text-xs text-muted-foreground break-all max-w-md">{description}</p>
      </div>
      {showInlineDownload && onDownload ? (
        <Button variant="default" size="sm" onClick={onDownload}>
          <Download className="size-4"/>
          {t.download}
        </Button>
      ) : null}
    </div>
  )
}
