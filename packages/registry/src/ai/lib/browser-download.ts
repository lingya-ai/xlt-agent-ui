const INVALID_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F]/g
const MAX_FILE_NAME_LENGTH = 180

/** 清理下载文件名中的路径和系统保留字符。 */
export function sanitizeDownloadFileName(fileName: string, fallback: string): string {
  const normalized = fileName
    .trim()
    .replace(INVALID_FILE_NAME_CHARACTERS, "-")
    .replace(/[.\s]+$/g, "")
    .slice(0, MAX_FILE_NAME_LENGTH)

  return normalized || fallback
}

/** 在文件名缺少指定扩展名时补齐扩展名。 */
export function ensureDownloadFileExtension(fileName: string, extension: string): string {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`
  return fileName.toLowerCase().endsWith(normalizedExtension.toLowerCase())
    ? fileName
    : `${fileName}${normalizedExtension}`
}

/** 通过浏览器原生下载能力保存 Data URL。 */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const anchor = document.createElement("a")
  anchor.href = dataUrl
  anchor.download = fileName
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

/** 通过临时 Object URL 保存 Blob，并在点击后释放 URL。 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
