'use client'

import {useEffect, useRef, useState} from 'react'
import Viewer from 'viewerjs'
import 'viewerjs/dist/viewer.css'
import {cn} from '../../../ui/lib/utils'
import type {PreviewerProps} from '../../types'
import {usePreviewControls} from '../../contexts/preview-controls-context'
import {PreviewError} from '../preview-error'
import {PreviewLoading} from '../preview-loading'

export interface ImagePreviewProps extends PreviewerProps {
}

/**
 * 图片预览器（基于 viewer.js）
 */
export function ImagePreview({source, fileName, config, className}: ImagePreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const [url, setUrl] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error>()
  const previewState = usePreviewControls({zoom: config.initialZoom ?? 1})

  useEffect(() => {
    const blob = new Blob([source])
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    setLoading(true)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [source])

  // 初始化 viewer.js
  useEffect(() => {
    if (!imgRef.current || !url) return

    const img = imgRef.current
    const handleLoad = () => setLoading(false)
    const handleError = () => {
      setError(new Error('图片加载失败'))
      setLoading(false)
    }
    img.addEventListener('load', handleLoad)
    img.addEventListener('error', handleError)

    const viewer = new Viewer(img, {
      inline: false,
      button: false,
      navbar: false,
      title: false,
      toolbar: {
        zoomIn: true,
        zoomOut: true,
        oneToOne: true,
        reset: true,
        prev: false,
        next: false,
        play: false,
        rotateLeft: true,
        rotateRight: true,
        flipHorizontal: true,
        flipVertical: true,
      },
      ready: () => setLoading(false),
    })
    viewerRef.current = viewer

    return () => {
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
      viewer.destroy()
      viewerRef.current = null
    }
  }, [url])

  if (loading && !url) {
    console.log('[ImagePreview] -> PreviewLoading', {loading, hasUrl: Boolean(url)})
    return <PreviewLoading className={className}/>
  }
  if (error) {
    console.log('[ImagePreview] -> PreviewError', {error})
    return <PreviewError error={error} variant="parse" className={className}/>
  }

  console.log('[ImagePreview] render img', {url, fileName})

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="flex-1 min-h-0 bg-muted/20 flex items-center justify-center overflow-hidden">
        {url ? (
          <img
            ref={imgRef}
            src={url}
            alt={fileName ?? '图片预览'}
            className="max-w-full max-h-full object-contain cursor-zoom-in"
            style={{
              transform: `scale(${previewState.zoom}) rotate(${previewState.rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out',
            }}
            draggable={false}
          />
        ) : null}
      </div>
    </div>
  )
}
