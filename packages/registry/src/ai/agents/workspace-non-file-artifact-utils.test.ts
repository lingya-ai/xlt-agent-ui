import {afterEach, describe, expect, it, vi} from "vitest";

import {
  WorkspaceNonFileArtifactKindEnum,
  type WorkspaceNonFileArtifact,
} from "../hooks/use-chat/use-workspace-files";
import {getWorkspaceNonFileArtifactPreviewUrl} from "./workspace-non-file-artifact-utils";

function createArtifact(previewUrl: string): WorkspaceNonFileArtifact {
  return {
    artifactId: 1,
    kind: WorkspaceNonFileArtifactKindEnum.HTML_PAGE,
    title: "页面制品",
    description: "用于预览协议转换测试",
    lastUpdateTime: new Date("2026-07-30T00:00:00Z"),
    previewUrl,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getWorkspaceNonFileArtifactPreviewUrl", () => {
  it("将 HTTP 预览地址替换为当前浏览器的 HTTPS 协议", () => {
    vi.stubGlobal("window", {location: {protocol: "https:"}});

    expect(
      getWorkspaceNonFileArtifactPreviewUrl(
        createArtifact("http://preview.example.com/project?id=1#result"),
      ),
    ).toBe("https://preview.example.com/project?id=1#result");
  });

  it("将 HTTPS 预览地址替换为当前浏览器的 HTTP 协议", () => {
    vi.stubGlobal("window", {location: {protocol: "http:"}});

    expect(
      getWorkspaceNonFileArtifactPreviewUrl(
        createArtifact("https://preview.example.com/project"),
      ),
    ).toBe("http://preview.example.com/project");
  });

  it("非 HTTP(S) 地址保持不变", () => {
    vi.stubGlobal("window", {location: {protocol: "https:"}});

    expect(
      getWorkspaceNonFileArtifactPreviewUrl(
        createArtifact("ftp://preview.example.com/project"),
      ),
    ).toBe("ftp://preview.example.com/project");
  });

  it("服务端环境保持原地址", () => {
    expect(
      getWorkspaceNonFileArtifactPreviewUrl(
        createArtifact("http://preview.example.com/project"),
      ),
    ).toBe("http://preview.example.com/project");
  });
});
