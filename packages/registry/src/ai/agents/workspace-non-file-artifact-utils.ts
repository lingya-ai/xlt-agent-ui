import {
  WorkspaceNonFileArtifactKindEnum,
  type WorkspaceNonFileArtifact,
} from "../hooks/use-chat/use-workspace-files";

/** 将 HTTP(S) 预览地址的协议替换为当前浏览器页面协议，避免 HTTPS 页面加载 HTTP 内容。 */
function replaceWithCurrentBrowserProtocol(previewUrl: string): string {
  if (typeof window === "undefined" || !/^https?:\/\//i.test(previewUrl)) {
    return previewUrl;
  }

  return previewUrl.replace(/^https?:/i, window.location.protocol);
}

/**
 * 返回当前非文件制品类型可用于预览的地址。
 * HTTP(S) 地址会跟随当前浏览器页面协议；未支持预览的类型统一返回 undefined。
 */
export function getWorkspaceNonFileArtifactPreviewUrl(
  artifact: WorkspaceNonFileArtifact,
): string | undefined {
  switch (artifact.kind) {
    case WorkspaceNonFileArtifactKindEnum.HTML_PAGE:
      return artifact.previewUrl
        ? replaceWithCurrentBrowserProtocol(artifact.previewUrl)
        : undefined;
    default:
      return undefined;
  }
}
