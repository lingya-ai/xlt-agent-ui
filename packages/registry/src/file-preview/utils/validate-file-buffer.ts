/** 文件二进制校验失败的稳定错误码。 */
export type FileBufferValidationCode = 'invalid-docx-archive' | 'invalid-pptx-archive'

/** 文件已成功读取，但内容不符合预期格式。 */
export class FileBufferValidationError extends Error {
  readonly code: FileBufferValidationCode

  constructor(code: FileBufferValidationCode) {
    super(code)
    this.name = 'FileBufferValidationError'
    this.code = code
  }
}

/** 文件二进制校验器。校验失败时应抛出 FileBufferValidationError。 */
export type FileBufferValidator = (buffer: ArrayBuffer) => void

const ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE = 22
const ZIP_MAX_COMMENT_SIZE = 0xffff

/** 校验 ZIP 容器是否包含完整的中央目录结束记录。 */
function validateZipArchive(buffer: ArrayBuffer, code: FileBufferValidationCode): void {
  if (buffer.byteLength < ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE) {
    throw new FileBufferValidationError(code)
  }

  const bytes = new Uint8Array(buffer)
  const searchStart = Math.max(
    0,
    bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE - ZIP_MAX_COMMENT_SIZE,
  )

  for (let offset = bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_MIN_SIZE; offset >= searchStart; offset -= 1) {
    if (
      bytes[offset] === 0x50
      && bytes[offset + 1] === 0x4b
      && bytes[offset + 2] === 0x05
      && bytes[offset + 3] === 0x06
    ) {
      return
    }
  }

  throw new FileBufferValidationError(code)
}

/**
 * 校验 DOCX 是否包含完整的 ZIP 中央目录结束记录。
 *
 * 下载被截断、预签名地址返回了错误页，或文件尚未写完时，提前校验可以触发
 * 文件加载层的无缓存重试，避免把可恢复错误交给渲染器。
 */
export const validateDocxArchive: FileBufferValidator = (buffer) => {
  validateZipArchive(buffer, 'invalid-docx-archive')
}

/** 校验 PPTX 是否包含完整的 ZIP 中央目录结束记录。 */
export const validatePptxArchive: FileBufferValidator = (buffer) => {
  validateZipArchive(buffer, 'invalid-pptx-archive')
}

/** 判断错误是否来自文件二进制校验。 */
export function isFileBufferValidationError(error: unknown): error is FileBufferValidationError {
  return error instanceof FileBufferValidationError
}
