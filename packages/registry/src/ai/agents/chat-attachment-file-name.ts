import {nanoid} from "nanoid";

import {PromptInputFileSource} from "../components/prompt-input-file-source";

export const MAX_ATTACHMENT_FILE_NAME_BYTES = 255;
// 后端首次处理重名时会追加 5 个 ASCII 字节（_ 加 4 位短后缀）。
const MAX_RENAMED_IMAGE_BYTES = 250;
const encoder = new TextEncoder();

export type PreparedChatAttachments = {
  files: File[];
  rejected: File[];
  renamed: {originalName: string; newName: string}[];
};

/** 按后端路径片段规则计算 NFC 文件名的 UTF-8 字节数 */
export function attachmentFileNameBytes(name: string): number {
  return encoder.encode(name.normalize("NFC")).length;
}

function imageExtension(mediaType: string): string | null {
  switch (mediaType) {
    case "image/png": return ".png";
    case "image/jpeg": return ".jpg";
    case "image/webp": return ".webp";
    case "image/gif": return ".gif";
    case "image/bmp": return ".bmp";
    case "image/avif": return ".avif";
    case "image/svg+xml": return ".svg";
    default: return null;
  }
}

/** 仅为粘贴图片缩短名称；扩展名和随机后缀计入字节预算 */
function shortenPastedImageName(file: File, suffix: string): string | null {
  const normalized = file.name.normalize("NFC");
  const dot = normalized.lastIndexOf(".");
  const base = dot > 0 ? normalized.slice(0, dot) : normalized;
  const extension = dot > 0 ? normalized.slice(dot) : imageExtension(file.type);
  if (!extension) return null;
  const ending = `-${suffix}${extension}`;
  const baseBudget = MAX_RENAMED_IMAGE_BYTES - encoder.encode(ending).length;
  if (baseBudget < 1) return null;

  let shortenedBase = "";
  let usedBytes = 0;
  for (const character of base) {
    const bytes = encoder.encode(character).length;
    if (usedBytes + bytes > baseBudget) break;
    shortenedBase += character;
    usedBytes += bytes;
  }
  return shortenedBase ? `${shortenedBase}${ending}` : null;
}

/** 在入队前过滤超长名称，并只为来自剪贴板的图片重建文件名 */
export function prepareChatAttachmentFiles(
  files: File[],
  source: PromptInputFileSource,
  createSuffix: () => string = () => nanoid(8),
): PreparedChatAttachments {
  const result: PreparedChatAttachments = {files: [], rejected: [], renamed: []};

  for (const file of files) {
    if (attachmentFileNameBytes(file.name) <= MAX_ATTACHMENT_FILE_NAME_BYTES) {
      result.files.push(file);
      continue;
    }

    if (source !== PromptInputFileSource.CLIPBOARD || !file.type.startsWith("image/")) {
      result.rejected.push(file);
      continue;
    }

    const newName = shortenPastedImageName(file, createSuffix());
    if (!newName || attachmentFileNameBytes(newName) > MAX_RENAMED_IMAGE_BYTES) {
      result.rejected.push(file);
      continue;
    }

    result.files.push(new File([file], newName, {type: file.type, lastModified: file.lastModified}));
    result.renamed.push({originalName: file.name, newName});
  }

  return result;
}
