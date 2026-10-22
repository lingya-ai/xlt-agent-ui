import { describe, expect, it } from "vitest";

import {
  buildAskUserQuestionAnswer,
  getRecommendedOptions,
  isValidAskUserQuestionAnswer,
  isValidSelectedOptions,
  orderSelectedOptions,
  toggleSelectedOption,
} from "./ask-user-question";

const options = [
  { text: "华东", recommended: true },
  { text: "华南", recommended: true },
  { text: "华北", recommended: false },
];

describe("ask user question selection", () => {
  it("切换多选项后仍保持后端选项顺序", () => {
    expect(toggleSelectedOption(options, ["华南"], "华东", true)).toEqual([
      "华东",
      "华南",
    ]);
    expect(
      toggleSelectedOption(options, ["华东", "华南"], "华东", false),
    ).toEqual(["华南"]);
  });

  it("过滤未知值和重复值", () => {
    expect(
      orderSelectedOptions(options, ["华南", "未知", "华南", "华东"]),
    ).toEqual(["华东", "华南"]);
  });

  it("分别校验单选和多选约束", () => {
    expect(isValidSelectedOptions(options, [], false)).toBe(false);
    expect(isValidSelectedOptions(options, ["华东"], false)).toBe(true);
    expect(isValidSelectedOptions(options, ["华北"], false)).toBe(true);
    expect(isValidSelectedOptions(options, ["华东", "华南"], false)).toBe(
      false,
    );
    expect(isValidSelectedOptions(options, ["华东", "华南"], true)).toBe(true);
    expect(isValidSelectedOptions(options, [], true)).toBe(false);
    expect(isValidSelectedOptions(options, ["未知"], true)).toBe(false);
  });

  it("按单选和多选模式初始化推荐项", () => {
    expect(getRecommendedOptions(options, false)).toEqual(["华东"]);
    expect(getRecommendedOptions(options, true)).toEqual(["华东", "华南"]);
  });

  it("自定义回答通过独立字段提交并清空预设选项", () => {
    expect(
      buildAskUserQuestionAnswer(
        options,
        ["华东"],
        "  其他区域  ",
      ),
    ).toEqual({ selectedOptions: [], customInput: "其他区域" });
  });

  it("预设选项保持后端顺序并将自定义字段置空", () => {
    expect(
      buildAskUserQuestionAnswer(
        options,
        ["华南", "华东"],
        "   ",
      ),
    ).toEqual({ selectedOptions: ["华东", "华南"], customInput: null });
  });

  it("校验回答只能来自预设选项或自定义输入之一", () => {
    expect(
      isValidAskUserQuestionAnswer(
        options,
        { selectedOptions: [], customInput: "其他区域" },
        false,
      ),
    ).toBe(true);
    expect(
      isValidAskUserQuestionAnswer(
        options,
        { selectedOptions: ["华东"], customInput: "其他区域" },
        true,
      ),
    ).toBe(false);
    expect(
      isValidAskUserQuestionAnswer(
        options,
        { selectedOptions: [], customInput: null },
        true,
      ),
    ).toBe(false);
  });
});
