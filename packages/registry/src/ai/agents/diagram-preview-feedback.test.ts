import assert from "node:assert/strict";
import { it } from "vitest";
import { getDiagramPreviewFeedback } from "./diagram-preview-feedback";
import { HtmlPageAuthoringModeEnum } from "../hooks/use-chat/workspace-non-file-artifact-schema";

it("图表错误可见，普通页面和成功日志保持原有流程", () => {
  const error = {
    kind: "console",
    level: "error",
    message: "Clipboard permission denied",
  } as const;
  assert.equal(
    getDiagramPreviewFeedback(HtmlPageAuthoringModeEnum.DIAGRAM, error),
    error.message,
  );
  assert.equal(getDiagramPreviewFeedback(undefined, error), undefined);
  assert.equal(
    getDiagramPreviewFeedback(HtmlPageAuthoringModeEnum.SOURCE, error),
    undefined,
  );
  assert.equal(
    getDiagramPreviewFeedback(HtmlPageAuthoringModeEnum.DIAGRAM, {
      ...error,
      level: "info",
    }),
    undefined,
  );
});
