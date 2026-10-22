'use client'

import {AlertTriangle, RefreshCw} from 'lucide-react'
import {useAgentMessages} from '../../i18n/runtime'
import {Button} from '../../ui/components/button'
import {cn} from '../../ui/lib/utils'
import {isFileBufferValidationError} from '../utils/validate-file-buffer'

export interface PreviewErrorProps {
  /** 错误信息 */
  error?: Error
  /** 错误类型，影响文案 */
  variant?: 'load' | 'parse'
  /** 重试回调 */
  onRetry?: () => void
  className?: string
}

/**
 * @file 文件预览错误兜底
 */
export function PreviewError({error, variant = 'load', onRetry, className}: PreviewErrorProps) {
  const t = useAgentMessages('preview-error')
  const title = variant === 'parse' ? t.parseError : t.loadError
  const errorMessage = isFileBufferValidationError(error)
    ? error.code === 'invalid-pptx-archive'
      ? t.invalidPptxArchive
      : t.invalidDocxArchive
    : error?.message

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 w-full h-full',
        'bg-muted/30 text-muted-foreground p-6 text-center',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="size-10 text-destructive"/>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {errorMessage ? (
          <p className="text-xs text-muted-foreground break-all max-w-md">{errorMessage}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4"/>
          {t.retry}
        </Button>
      ) : null}
    </div>
  )
}
