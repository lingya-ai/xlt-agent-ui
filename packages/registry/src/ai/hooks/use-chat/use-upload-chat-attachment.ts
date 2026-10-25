import {ApiError} from "@lingya-ai/agents-sdk/browser";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import type {GeneratePreSignedUrlOutput} from "@lingya-ai/agents-sdk/browser";
import {useAiChatRequestSignal} from "../../agents/context";
import {useCallback} from "react"
import {fileMd5} from "../../lib/file-md5"

// ============ Hook ============

/**
 * 上传聊天附件
 *
 * 组合上传流程：MD5 校验 → 秒传检查 → 预签名上传 → 确认。
 * 调用 agents controller 上的 `/chat/files/...` 系列接口。
 *
 * @param httpClient - 已配置好 basePath 的 HTTP 客户端
 * @returns `(file: File) => Promise<number>`（文件 ID）
 */
export function useUploadChatAttachment(httpClient: AgentsClient, requireAccess?: () => void): (file: File) => Promise<number> {
  const signal = useAiChatRequestSignal(httpClient);
  return useCallback(async (file: File): Promise<number> => {
    requireAccess?.();
    const contentMd5 = await fileMd5(file)

    // 秒传检查
    let exists = false
    try {
      const result = await httpClient.files.fileExistsByContentMd5({contentMd5, signal})
      exists = result._exists
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        exists = false
      } else {
        throw error
      }
    }

    // 已存在：创建记录即可
    if (exists) {
      requireAccess?.();
      const fileRecord = await httpClient.files.createFileByContentMd5({fileName: file.name, contentMd5}, {signal})
      return fileRecord.id
    }

    // 预签名上传
    requireAccess?.();
    const preSignedOutput = await httpClient.files.createPreSignedUpload({fileName: file.name, module: 'ai-chat-attachments', contentMd5, sizeBytes: file.size}, {signal})

    if (preSignedOutput.support) {
      if (!preSignedOutput.url || !preSignedOutput.fileUk) throw new ApiError("POST","/files/pre-signed",undefined,"",{kind:"protocol"});
      // XHR 直传
      await uploadViaXhr(preSignedOutput, file, contentMd5, signal)

      requireAccess?.();
      const fileRecord = await httpClient.files.confirmPreSignedUpload({fileUk: preSignedOutput.fileUk!, contentMd5}, {signal})
      return fileRecord.id
    }

    throw new Error("文件上传失败：预签名不支持")
  }, [httpClient, requireAccess, signal])
}

/**
 * 通过 XHR 上传文件到预签名地址
 */
function uploadViaXhr(
  signed: GeneratePreSignedUrlOutput,
  file: File,
  contentMd5: string,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("上传已取消", "AbortError")); return; }
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, {once: true});
    xhr.onloadend = () => signal?.removeEventListener("abort", abort);
    xhr.onabort = () => reject(new DOMException("上传已取消", "AbortError"));
    // 后端可能签发 PUT 或对象存储表单 POST；按响应协议发送，不能一律 PUT。
    const formUpload = signed.uploadMethod === "POST_FORM";
    xhr.open(formUpload ? 'POST' : 'PUT', signed.url!, true)
    if (!formUpload) xhr.setRequestHeader('Content-MD5', contentMd5)

    xhr.onerror = () => reject(new Error("文件上传失败"))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`文件上传失败：${xhr.status}`))
      }
    }

    try {
      if (formUpload) {
        const form = new FormData()
        Object.entries(signed.formFields ?? {}).forEach(([name, value]) => form.append(name, value))
        form.append('file', file, file.name)
        xhr.send(form)
      } else {
        xhr.send(file)
      }
    } catch {
      reject(new Error("文件上传失败"))
    }
  })
}
