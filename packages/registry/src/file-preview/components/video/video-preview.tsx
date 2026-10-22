'use client'

import {useEffect, useState} from 'react'
import {cn} from '../../../ui/lib/utils'
import type {PreviewerProps} from '../../types'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export interface VideoPreviewProps extends PreviewerProps {}

/** 视频预览器（原生 video 标签）。 */
export function VideoPreview({source, mimeType, className}: VideoPreviewProps) {
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
    <div className={cn('flex min-h-0 flex-col bg-black', className)}>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {!url ? (
          <PreviewLoading/>
        ) : (
          <video
            src={url}
            controls
            autoPlay={false}
            className="max-h-full max-w-full"
            onError={() => setError(new Error('视频加载失败'))}
          >
            您的浏览器不支持视频播放。
          </video>
        )}
      </div>
    </div>
  )
}
