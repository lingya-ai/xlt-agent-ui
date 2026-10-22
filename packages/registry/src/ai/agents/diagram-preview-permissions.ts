// 将图表导出权限限定在后端给出的预览来源，导航到其他来源时收回。
import { HtmlPageAuthoringModeEnum } from "../hooks/use-chat/workspace-non-file-artifact-schema";

const baseSandbox =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation";

export function getDiagramPreviewPermissions(
  mode: HtmlPageAuthoringModeEnum | null | undefined,
  previewUrl: string | undefined,
  targetUrl: string,
) {
  if (mode !== HtmlPageAuthoringModeEnum.DIAGRAM || !previewUrl)
    return { sandbox: baseSandbox, allow: undefined };
  try {
    const preview = new URL(previewUrl);
    const target = new URL(targetUrl);
    if (
      !["https:", "http:"].includes(preview.protocol) ||
      target.origin !== preview.origin
    )
      return { sandbox: baseSandbox, allow: undefined };
    return {
      sandbox: `${baseSandbox} allow-downloads`,
      allow: `clipboard-write ${preview.origin}`,
    };
  } catch {
    return { sandbox: baseSandbox, allow: undefined };
  }
}
