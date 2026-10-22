// @vitest-environment jsdom

import {describe, expect, it} from "vitest";

import {PromptInputFileSource} from "../components/prompt-input-file-source";
import {
  attachmentFileNameBytes,
  MAX_ATTACHMENT_FILE_NAME_BYTES,
  prepareChatAttachmentFiles,
} from "./chat-attachment-file-name";

function makeFile(name: string, type = "image/png"): File {
  return new File(["image-data"], name, {type, lastModified: 123});
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

describe("聊天附件文件名", () => {
  it("按 NFC 后的 UTF-8 字节数判断边界", () => {
    expect(attachmentFileNameBytes("a".repeat(255))).toBe(255);
    expect(attachmentFileNameBytes("a".repeat(256))).toBe(256);
    expect(attachmentFileNameBytes("汉".repeat(85))).toBe(255);
    expect(attachmentFileNameBytes("😀".repeat(63) + "abc")).toBe(255);
    expect(attachmentFileNameBytes("e\u0301")).toBe(2);
    expect(MAX_ATTACHMENT_FILE_NAME_BYTES).toBe(255);
  });

  it.each([PromptInputFileSource.PICKER, PromptInputFileSource.DROP])(
    "%s 来源保留合法文件并拒绝超长文件",
    (source) => {
      const valid = makeFile("a".repeat(255));
      const long = makeFile("a".repeat(256));
      const result = prepareChatAttachmentFiles([valid, long], source);

      expect(result.files).toEqual([valid]);
      expect(result.rejected).toEqual([long]);
      expect(result.renamed).toEqual([]);
    },
  );

  it("粘贴图片按完整 Unicode 字符截断，并保留扩展名和文件内容", async () => {
    const original = makeFile("😀".repeat(80) + ".png");
    const result = prepareChatAttachmentFiles(
      [original],
      PromptInputFileSource.CLIPBOARD,
      () => "abcdefgh",
    );
    const renamed = result.files[0];

    expect(result.rejected).toEqual([]);
    expect(result.renamed).toEqual([{originalName: original.name, newName: renamed?.name}]);
    expect(renamed?.name).toMatch(/^😀+-abcdefgh\.png$/u);
    expect(attachmentFileNameBytes(renamed?.name ?? "")).toBeLessThanOrEqual(250);
    expect(renamed?.type).toBe(original.type);
    expect(renamed?.lastModified).toBe(original.lastModified);
    expect(await readFile(renamed!)).toBe(await readFile(original));
  });

  it("粘贴的非图片不改名，扩展名无法放入预算时拒绝", () => {
    const document = makeFile("文".repeat(86) + ".pdf", "application/pdf");
    const image = makeFile("a." + "b".repeat(254));
    const result = prepareChatAttachmentFiles(
      [document, image],
      PromptInputFileSource.CLIPBOARD,
      () => "abcdefgh",
    );

    expect(result.files).toEqual([]);
    expect(result.rejected).toEqual([document, image]);
    expect(result.renamed).toEqual([]);
  });

  it("超长粘贴图片没有扩展名时按 MIME 补全", () => {
    const image = makeFile("截图".repeat(90));
    const result = prepareChatAttachmentFiles(
      [image],
      PromptInputFileSource.CLIPBOARD,
      () => "abcdefgh",
    );

    expect(result.files[0]?.name).toMatch(/-abcdefgh\.png$/u);
    expect(attachmentFileNameBytes(result.files[0]?.name ?? "")).toBeLessThanOrEqual(250);
  });
});
