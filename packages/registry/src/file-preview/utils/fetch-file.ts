'use client'

import type {FileSource, FileSourceUrl} from '../types'

export interface FetchAsArrayBufferOptions {
  /** 取消正在进行的 URL 请求。 */
  signal?: AbortSignal
  /** URL 请求缓存策略。 */
  cache?: RequestCache
}

/**
 * 将任意文件源加载为 ArrayBuffer
 * @param source 文件源
 * @param options URL 请求配置
 * @returns ArrayBuffer
 *
 * @example
 * const buf = await fetchAsArrayBuffer('/files/a.pdf')
 * const buf = await fetchAsArrayBuffer({url: '/api/files/x', headers: {Authorization: 'Bearer ...'}})
 */
export async function fetchAsArrayBuffer(
  source: FileSource,
  options: FetchAsArrayBufferOptions = {},
): Promise<ArrayBuffer> {
  // 字符串 URL
  if (typeof source === 'string') {
    return fetchUrl({url: source}, options)
  }

  // URL 对象（带 headers）
  if ('url' in source) {
    return fetchUrl(source, options)
  }

  // 二进制对象
  const {data} = source
  if (data instanceof ArrayBuffer) return data
  return data.arrayBuffer()
}

/**
 * 加载 URL 为 ArrayBuffer
 */
async function fetchUrl(
  {url, headers, withCredentials}: FileSourceUrl,
  {signal, cache}: FetchAsArrayBufferOptions,
): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: withCredentials ? 'include' : 'same-origin',
    signal,
    cache,
  })

  if (!response.ok) {
    throw new Error(`文件加载失败: ${response.status} ${response.statusText}`)
  }

  return response.arrayBuffer()
}

/**
 * 将 ArrayBuffer / Blob 转为带 MIME 的 Blob
 */
export function bufferToBlob(data: ArrayBuffer | Blob, mimeType?: string): Blob {
  if (data instanceof Blob) {
    // 已经是 Blob：仅在显式指定 mimeType 时重新包装
    return mimeType ? new Blob([data], {type: mimeType}) : data
  }
  return new Blob([data], mimeType ? {type: mimeType} : undefined)
}

/**
 * 创建文件 URL（用于原生预览，如 video/audio）
 */
export function createObjectUrl(source: FileSource, mimeType?: string): string {
  if (typeof source === 'string') return source
  if ('url' in source) return source.url
  return URL.createObjectURL(bufferToBlob(source.data, mimeType))
}
