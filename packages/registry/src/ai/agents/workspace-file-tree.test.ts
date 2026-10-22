import { describe, expect, it } from "vitest";

import { buildWorkspaceFileTree } from "./workspace-file-tree";

describe("buildWorkspaceFileTree", () => {
  it("按相对路径构建目录，并让目录排在同级文件之前", () => {
    const tree = buildWorkspaceFileTree([
      {
        relativePath: "README.md",
        size: 12,
        fileName: "README.md",
        mimeType: "text/markdown",
        lastUpdateTime: new Date("2026-07-29T00:00:00Z"),
      },
      {
        relativePath: "attachments/report.pdf",
        size: 128,
        fileName: "report.pdf",
        mimeType: "application/pdf",
        lastUpdateTime: new Date("2026-07-29T00:00:00Z"),
      },
      {
        relativePath: "attachments/images/logo.png",
        size: 64,
        fileName: "logo.png",
        mimeType: "image/png",
        lastUpdateTime: new Date("2026-07-29T00:00:00Z"),
      },
    ]);

    expect(tree).toMatchObject([
      {
        type: "folder",
        name: "attachments",
        path: "attachments",
        children: [
          {
            type: "folder",
            name: "images",
            path: "attachments/images",
            children: [
              {
                type: "file",
                file: { relativePath: "attachments/images/logo.png" },
              },
            ],
          },
          {
            type: "file",
            file: { relativePath: "attachments/report.pdf" },
          },
        ],
      },
      {
        type: "file",
        file: { relativePath: "README.md" },
      },
    ]);
  });

  it("兼容反斜杠分隔的相对路径", () => {
    const tree = buildWorkspaceFileTree([
      {
        relativePath: "exports\\2026\\summary.xlsx",
        size: 256,
        fileName: "summary.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        lastUpdateTime: new Date("2026-07-29T00:00:00Z"),
      },
    ]);

    expect(tree[0]).toMatchObject({
      type: "folder",
      name: "exports",
      path: "exports",
      children: [
        {
          type: "folder",
          name: "2026",
          path: "exports/2026",
        },
      ],
    });
  });
});
