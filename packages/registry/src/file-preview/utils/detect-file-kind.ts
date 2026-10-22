'use client'

import type {FileKindOrAuto, FileSource, PreviewerDefinition, PreviewerKind} from '../types'
import {EXTENSION_TO_KIND} from '../constants/supported-extensions'
import {resolvePreviewerByFile} from '../registry/previewer-registry'
import {resolvePreviewerByFileFromDefinitions} from './resolve-previewer'
import {MIME_TO_KIND} from '../constants/file-type'

/**
 * 从文件名提取扩展名（小写、不含点）
 * @param fileName 文件名
 * @returns 扩展名，无扩展名返回 undefined
 *
 * @example
 * extractExtension('report.PDF')   // 'pdf'
 * extractExtension('file')         // undefined
 */
export function extractExtension(fileName?: string): string | undefined {
  if (!fileName) return undefined
  const idx = fileName.lastIndexOf('.')
  if (idx < 0 || idx === fileName.length - 1) return undefined
  return fileName.slice(idx + 1).toLowerCase()
}

/**
 * 根据文件名和 MIME 类型识别文件类别
 * @param fileName 文件名
 * @param mimeType MIME 类型
 * @param previewers 当前 FilePreview 实例的自定义预览器
 * @returns 内置或已注册的预览类别，无法识别返回 'unsupported'
 *
 * @example
 * detectFileKind('report.pdf')                              // 'pdf'
 * detectFileKind(undefined, 'application/pdf')              // 'pdf'
 * detectFileKind('file.unknown')                            // 'unsupported'
 */
export function detectFileKind(
  fileName?: string,
  mimeType?: string,
  previewers?: readonly PreviewerDefinition[],
): PreviewerKind {
  // 实例入参优先于全局注册和内置格式，允许按使用场景覆盖既有扩展名的处理方式。
  const contextualPreviewer = resolvePreviewerByFileFromDefinitions(previewers, fileName, mimeType)
  if (contextualPreviewer) return contextualPreviewer.kind

  const registeredPreviewer = resolvePreviewerByFile(fileName, mimeType)
  if (registeredPreviewer) return registeredPreviewer.kind

  // 优先用扩展名判断
  const ext = extractExtension(fileName)
  if (ext && EXTENSION_TO_KIND[ext]) {
    return EXTENSION_TO_KIND[ext]
  }

  // 其次用 MIME 判断
  if (mimeType) {
    // 处理类似 "text/plain; charset=utf-8" 的情况
    const pureMime = mimeType.split(';')[0]?.trim().toLowerCase()
    if (pureMime && MIME_TO_KIND[pureMime]) {
      return MIME_TO_KIND[pureMime]
    }
  }

  return 'unsupported'
}

/**
 * 解析用户传入的 fileKind 参数
 * - 'auto' 或 undefined：自动识别
 * - 其他值：直接返回
 */
export function resolveFileKind(
  fileKind: FileKindOrAuto | undefined,
  detected: PreviewerKind,
): PreviewerKind {
  if (!fileKind || fileKind === 'auto') return detected
  return fileKind
}

/**
 * 判断文件源是否为 URL 形式
 */
export function isUrlSource(source: FileSource): source is string | { url: string; headers?: HeadersInit } {
  if (typeof source === 'string') return true
  return typeof source === 'object' && source !== null && !('data' in source) && 'url' in source
}

/**
 * 从文件源提取文件名（用于推断格式）
 */
export function extractFileName(source: FileSource): string | undefined {
  if (typeof source === 'string') {
    return tryDecodeUrlFileName(source)
  }
  if ('url' in source) {
    return tryDecodeUrlFileName(source.url)
  }
  return source.name
}

/**
 * 从 URL 中提取文件名（去除 querystring 和 hash）
 */
function tryDecodeUrlFileName(url: string): string | undefined {
  try {
    const u = new URL(url, window.location.origin)
    const pathname = u.pathname
    if (!pathname) return undefined
    const last = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '')
    return last || undefined
  } catch {
    // 非 URL 字符串，按最后一段斜杠处理
    const cleaned = url.split('?')[0]?.split('#')[0]
    if (!cleaned) return undefined
    const last = cleaned.split('/').filter(Boolean).pop()
    return last ? decodeURIComponent(last) : undefined
  }
}
