'use client'

import type {PreviewerDefinition, PreviewerKind} from '../types'

const registry = new Map<PreviewerKind, PreviewerDefinition>()
const extensionToKind = new Map<string, PreviewerKind>()
const mimeTypeToKind = new Map<string, PreviewerKind>()

/**
 * 注册外部预览器。
 *
 * 同一类别重复注册时以最后一次定义为准；扩展名和 MIME 类型冲突时同样由最后注册的预览器接管。
 * 注册动作必须在 FilePreview 首次渲染前完成，才能参与 fileKind="auto" 的格式识别。
 */
export function registerPreviewer(def: PreviewerDefinition): void {
  removeKindMappings(def.kind)
  registry.set(def.kind, def)

  for (const extension of def.extensions) {
    const normalized = normalizeExtension(extension)
    if (normalized) extensionToKind.set(normalized, def.kind)
  }

  for (const mimeType of def.mimeTypes) {
    const normalized = normalizeMimeType(mimeType)
    if (normalized) mimeTypeToKind.set(normalized, def.kind)
  }
}

/** 批量注册外部预览器。 */
export function registerPreviewers(defs: PreviewerDefinition[]): void {
  defs.forEach(registerPreviewer)
}

/** 按类别获取预览器。 */
export function resolvePreviewer(kind: PreviewerKind): PreviewerDefinition | undefined {
  return registry.get(kind)
}

/**
 * 根据文件名或 MIME 类型获取已注册预览器。
 * 扩展名优先于 MIME 类型，以便与内置格式识别规则保持一致。
 */
export function resolvePreviewerByFile(
  fileName?: string,
  mimeType?: string,
): PreviewerDefinition | undefined {
  const extension = extractExtension(fileName)
  if (extension) {
    const kind = extensionToKind.get(extension)
    if (kind) return registry.get(kind)
  }

  const normalizedMimeType = normalizeMimeType(mimeType)
  if (normalizedMimeType) {
    const kind = mimeTypeToKind.get(normalizedMimeType)
    if (kind) return registry.get(kind)
  }

  return undefined
}

/** 列出所有已注册的预览器类别。 */
export function listRegisteredKinds(): PreviewerKind[] {
  return Array.from(registry.keys())
}

/** 判断某类别是否已注册。 */
export function isKindRegistered(kind: PreviewerKind): boolean {
  return registry.has(kind)
}

/** 移除已注册预览器（主要用于测试或动态卸载）。 */
export function unregisterPreviewer(kind: PreviewerKind): boolean {
  const removed = registry.delete(kind)
  if (removed) removeKindMappings(kind)
  return removed
}

function removeKindMappings(kind: PreviewerKind): void {
  for (const [extension, registeredKind] of extensionToKind) {
    if (registeredKind === kind) extensionToKind.delete(extension)
  }
  for (const [mimeType, registeredKind] of mimeTypeToKind) {
    if (registeredKind === kind) mimeTypeToKind.delete(mimeType)
  }
}

function extractExtension(fileName?: string): string | undefined {
  if (!fileName) return undefined
  const index = fileName.lastIndexOf('.')
  if (index < 0 || index === fileName.length - 1) return undefined
  return normalizeExtension(fileName.slice(index + 1))
}

function normalizeExtension(extension: string): string | undefined {
  const normalized = extension.trim().replace(/^\.+/, '').toLowerCase()
  return normalized || undefined
}

function normalizeMimeType(mimeType?: string): string | undefined {
  if (!mimeType) return undefined
  const normalized = mimeType.split(';')[0]?.trim().toLowerCase()
  return normalized || undefined
}
