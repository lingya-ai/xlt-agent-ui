'use client'

import {useEffect, useState} from 'react'
import {AudioLines} from 'lucide-react'
import {cn} from '../../../ui/lib/utils'
import type {PreviewerProps} from '../../types'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export interface AudioPreviewProps extends PreviewerProps {
}

/** 音频预览器（原生 audio 标签 + 波形占位）。 */
export function AudioPreview({source, fileName, mimeType, className}: AudioPreviewProps) {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<Error>()

  useEffect(() => {
    const blob = new Blob([source], mimeType ? {type: mimeType} : undefined)
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [mimeType, source])

  if (error) return <PreviewError error={error} variant="parse" className={className}/>

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 bg-muted/20 p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-24 items-center justify-center rounded-full bg-muted">
            <AudioLines className="size-12 text-primary"/>
          </div>
          {fileName ? <p className="text-center text-sm font-medium text-foreground break-all">{fileName}</p> : null}
        </div>

        {!url ? (
          <PreviewLoading/>
        ) : (
          <audio
            src={url}
            controls
            autoPlay={false}
            className="w-full max-w-md"
            onError={() => setError(new Error('音频加载失败'))}
          />
        )}
      </div>
    </div>
  )
}
