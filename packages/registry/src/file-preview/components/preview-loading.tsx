'use client'
import {FileIcon, Loader2} from 'lucide-react'
import {useAgentMessages} from '../../i18n/runtime'
import {cn} from '../../ui/lib/utils'

export interface PreviewLoadingProps {
  className?: string
}

/**
 * @file 文件预览加载占位
 */
export function PreviewLoading({className}: PreviewLoadingProps) {
  const t = useAgentMessages('preview-loading')
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 w-full h-full',
        'bg-muted/30 text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <FileIcon className="size-12 opacity-30"/>
        <Loader2 className="size-5 absolute -right-1 -bottom-1 animate-spin text-primary"/>
      </div>
      <span className="text-sm">{t.loading}</span>
    </div>
  )
}
