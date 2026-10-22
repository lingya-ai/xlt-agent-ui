import { describe, expect, it } from "vitest";
import { getDiagramPreviewPermissions } from "./diagram-preview-permissions";
import {
  HtmlPageAuthoringModeEnum,

} from "../hooks/use-chat/workspace-non-file-artifact-schema";

describe("diagram 预览权限", () => {
  it("公开契约不携带编辑模式，未由宿主启用时不授予下载权限", () => {
    expect(getDiagramPreviewPermissions(undefined,"https://preview.example.com/","https://preview.example.com/").sandbox).not.toContain("allow-downloads");
  });
  it("仅对匹配的 diagram 预览来源开放下载与剪贴板写入", () => {
    const permission = getDiagramPreviewPermissions(
      HtmlPageAuthoringModeEnum.DIAGRAM,
      "https://preview.example.com/",
      "https://preview.example.com/?embed=1",
    );
    expect(permission.sandbox).toContain("allow-downloads");
    expect(permission.allow).toBe(
      "clipboard-write https://preview.example.com",
    );
  });
  it("通用页面、来源变化与非法地址收回权限", () => {
    for (const permission of [
      getDiagramPreviewPermissions(
        HtmlPageAuthoringModeEnum.SOURCE,
        "https://preview.example.com/",
        "https://preview.example.com/",
      ),
      getDiagramPreviewPermissions(
        HtmlPageAuthoringModeEnum.DIAGRAM,
        "https://preview.example.com/",
        "https://other.example.com/",
      ),
      getDiagramPreviewPermissions(
        HtmlPageAuthoringModeEnum.DIAGRAM,
        "bad",
        "bad",
      ),
    ]) {
      expect(permission.sandbox).not.toContain("allow-downloads");
      expect(permission.allow).toBeUndefined();
    }
  });
});
