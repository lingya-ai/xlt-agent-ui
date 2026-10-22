import { describe, expect, it } from "vitest";
import {
  findActiveInputSyntax,
  removeInputSyntaxToken,
} from "./input-syntax";

describe("findActiveInputSyntax", () => {
  it("识别输入开头的触发器", () => {
    expect(findActiveInputSyntax("@skill", 6)).toEqual({
      trigger: "@",
      start: 0,
      end: 6,
      query: "skill",
    });
  });

  it.each(["/", "@", "#", "$"] as const)("识别 %s 触发器", (trigger) => {
    expect(findActiveInputSyntax(`${trigger}能力`, 3)?.trigger).toBe(trigger);
  });

  it("识别空白后的触发器并支持光标位于 token 中间", () => {
    expect(findActiveInputSyntax("请使用 #知识库 完成", 7)).toEqual({
      trigger: "#",
      start: 4,
      end: 8,
      query: "知识库",
    });
  });

  it("不匹配 URL、邮箱和普通文本中的符号", () => {
    expect(findActiveInputSyntax("https://example.com", 19)).toBeNull();
    expect(findActiveInputSyntax("user@example.com", 16)).toBeNull();
    expect(findActiveInputSyntax("hello/world", 11)).toBeNull();
  });

  it("选区非折叠时不触发", () => {
    expect(findActiveInputSyntax("@skill", 0, 2)).toBeNull();
  });

  it("空输入、无光标或无效光标时不触发", () => {
    expect(findActiveInputSyntax("", 0)).toBeNull();
    expect(findActiveInputSyntax("@skill", null)).toBeNull();
    expect(findActiveInputSyntax("hello", 999)).toBeNull();
  });
});

describe("removeInputSyntaxToken", () => {
  it("删除开头 token 和后置空白", () => {
    const token = findActiveInputSyntax("@skill 继续", 6);
    expect(token).not.toBeNull();
    expect(removeInputSyntaxToken("@skill 继续", token!)).toEqual({
      value: "继续",
      cursor: 0,
    });
  });

  it("删除中间 token 并保留一侧空白", () => {
    const value = "请使用 @skill 完成";
    const token = findActiveInputSyntax(value, 8);
    expect(token).not.toBeNull();
    expect(removeInputSyntaxToken(value, token!)).toEqual({
      value: "请使用 完成",
      cursor: 4,
    });
  });

  it("删除末尾 token 和前置空白", () => {
    const value = "请使用 @skill";
    const token = findActiveInputSyntax(value, value.length);
    expect(token).not.toBeNull();
    expect(removeInputSyntaxToken(value, token!)).toEqual({
      value: "请使用",
      cursor: 3,
    });
  });
});
