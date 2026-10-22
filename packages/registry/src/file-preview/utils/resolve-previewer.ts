import type {PreviewerDefinition, PreviewerKind} from '../types'

/** 根据类别从预览器定义中解析组件，后定义的同类别预览器优先。 */
export function resolvePreviewerFromDefinitions(
  previewers: readonly PreviewerDefinition[] | undefined,
  kind: PreviewerKind,
): PreviewerDefinition | undefined {
  if (!previewers) return undefined

  for (let index = previewers.length - 1; index >= 0; index -= 1) {
    const previewer = previewers[index]
    if (previewer?.kind === kind) return previewer
  }

  return undefined
}

/**
 * 根据文件名或 MIME 类型从预览器定义中解析组件。
 * 扩展名优先于 MIME 类型，后定义的同格式预览器优先。
 */
export function resolvePreviewerByFileFromDefinitions(
  previewers: readonly PreviewerDefinition[] | undefined,
  fileName?: string,
  mimeType?: string,
): PreviewerDefinition | undefined {
  if (!previewers) return undefined

  const extension = extractExtension(fileName)
  if (extension) {
    for (let index = previewers.length - 1; index >= 0; index -= 1) {
      const previewer = previewers[index]
      if (previewer?.extensions.some((item) => normalizeExtension(item) === extension)) {
        return previewer
      }
    }
  }

  const normalizedMimeType = normalizeMimeType(mimeType)
  if (normalizedMimeType) {
    for (let index = previewers.length - 1; index >= 0; index -= 1) {
      const previewer = previewers[index]
      if (previewer?.mimeTypes.some((item) => normalizeMimeType(item) === normalizedMimeType)) {
        return previewer
      }
    }
  }

  return undefined
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
