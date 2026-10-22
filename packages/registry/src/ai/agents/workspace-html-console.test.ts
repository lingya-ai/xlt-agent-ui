import { describe, expect, it } from "vitest";
import {
  createWorkspaceHtmlPreviewEmbedUrl,
  getWorkspaceHtmlPreviewOrigin,
  isWorkspaceHtmlPreviewMessage,
  sanitizeWorkspaceHtmlPreviewUrl,
} from "./workspace-html-console";

describe("workspace-html-console", () => {
  it("为独立预览 Origin 生成嵌入会话地址", () => {
    const embedUrl = createWorkspaceHtmlPreviewEmbedUrl(
      "http://qrr8egkv.lingya.localhost:8080/?view=detail#chart",
      "workspace-html-console-123456",
      "http://lingya.localhost:4000",
    );
    const parsed = new URL(embedUrl ?? "");

    expect(parsed.origin).toBe("http://qrr8egkv.lingya.localhost:8080");
    expect(parsed.searchParams.get("view")).toBe("detail");
    expect(parsed.searchParams.get("__xlt_embed")).toBe("1");
    expect(parsed.searchParams.get("__xlt_session")).toBe(
      "workspace-html-console-123456",
    );
    expect(parsed.searchParams.get("__xlt_parent_origin")).toBe(
      "http://lingya.localhost:4000",
    );
    expect(parsed.hash).toBe("#chart");
  });

  it("清理页面回传地址中的内部嵌入参数", () => {
    expect(
      sanitizeWorkspaceHtmlPreviewUrl(
        "http://qrr8egkv.lingya.localhost:8080/about?__xlt_embed=1&__xlt_session=a&name=test#__xlt",
      ),
    ).toBe("http://qrr8egkv.lingya.localhost:8080/about?name=test#__xlt");
  });

  it("严格校验版本、会话和事件载荷", () => {
    const message = {
      namespace: "xiaolingtong.html-preview",
      version: 1,
      sessionId: "workspace-html-console-123456",
      sequence: 1,
      timestamp: 1_786_576_800_000,
      pageUrl: "http://qrr8egkv.lingya.localhost:8080/",
      event: {
        kind: "network",
        transport: "fetch",
        method: "GET",
        url: "http://qrr8egkv.lingya.localhost:8080/data.json",
        status: 404,
        ok: false,
        duration: 12,
        error: "",
      },
    };

    expect(
      isWorkspaceHtmlPreviewMessage(message, "workspace-html-console-123456"),
    ).toBe(true);
    expect(isWorkspaceHtmlPreviewMessage(message, "another-session")).toBe(
      false,
    );
    expect(
      isWorkspaceHtmlPreviewMessage(
        { ...message, version: 2 },
        "workspace-html-console-123456",
      ),
    ).toBe(false);
  });

  it("只识别 HTTP 和 HTTPS 预览 Origin", () => {
    expect(
      getWorkspaceHtmlPreviewOrigin(
        "http://qrr8egkv.lingya.localhost:8080/path",
      ),
    ).toBe("http://qrr8egkv.lingya.localhost:8080");
    expect(
      getWorkspaceHtmlPreviewOrigin("javascript:alert(1)"),
    ).toBeUndefined();
  });
});
