'use client'

/**
 * 格式化字节大小为可读字符串
 * @param bytes 字节数
 * @returns 格式化字符串
 *
 * @example
 * formatFileSize(0)            // '0 B'
 * formatFileSize(1536)         // '1.5 KB'
 * formatFileSize(1048576)      // '1 MB'
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / Math.pow(1024, exponent)
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(exponent === 1 ? 1 : 2)
  return `${formatted} ${units[exponent]}`
}
