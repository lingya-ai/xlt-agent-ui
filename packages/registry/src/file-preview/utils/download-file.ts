'use client'

import type {FileSource} from '../types'
import {bufferToBlob, fetchAsArrayBuffer} from './fetch-file'

/**
 * 触发文件下载
 * @param source 文件源
 * @param fileName 保存的文件名（不传则尝试从 URL 提取）
 */
export async function downloadFile(source: FileSource, fileName?: string): Promise<void> {
  let blob: Blob
  let name = fileName

  if (typeof source === 'string') {
    const buffer = await fetchAsArrayBuffer(source)
    const mimeType = await guessMimeFromUrl(source)
    blob = bufferToBlob(buffer, mimeType)
    name ??= extractFileNameFromUrl(source)
  } else if ('url' in source) {
    const buffer = await fetchAsArrayBuffer(source)
    const mimeType = await guessMimeFromUrl(source.url)
    blob = bufferToBlob(buffer, mimeType)
    name ??= extractFileNameFromUrl(source.url)
  } else {
    blob = bufferToBlob(source.data, source.mimeType)
    name ??= source.name
  }

  triggerBlobDownload(blob, name ?? 'download')
}

/**
 * 直接触发 Blob 下载
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 延迟释放，避免某些浏览器下载被取消
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function guessMimeFromUrl(url: string): Promise<string | undefined> {
  try {
    const u = new URL(url, window.location.origin)
    const ext = u.pathname.split('.').pop()?.toLowerCase()
    if (!ext) return undefined
    // 简单映射，避免引入 mime 包
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    }
    return map[ext]
  } catch {
    return undefined
  }
}

function extractFileNameFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url, window.location.origin)
    const last = u.pathname.split('/').filter(Boolean).pop()
    return last ? decodeURIComponent(last) : undefined
  } catch {
    return undefined
  }
}
