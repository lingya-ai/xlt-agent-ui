import { HtmlPageAuthoringModeEnum } from "../hooks/use-chat/workspace-non-file-artifact-schema";
import type { WorkspaceHtmlPreviewEvent } from "./workspace-html-console";

/** 调用方完成来源、窗口与会话校验后，将图表导出错误显示在预览页面。 */
export function getDiagramPreviewFeedback(
  mode: HtmlPageAuthoringModeEnum | null | undefined,
  event: WorkspaceHtmlPreviewEvent,
): string | undefined {
  if (mode !== HtmlPageAuthoringModeEnum.DIAGRAM) return undefined;
  if (
    (event.kind === "console" && event.level === "error") ||
    event.kind === "runtime-error" ||
    event.kind === "unhandled-rejection"
  ) {
    return event.message.slice(0, 2000);
  }
  return undefined;
}
