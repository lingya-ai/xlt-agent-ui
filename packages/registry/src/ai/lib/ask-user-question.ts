import type { AskUserQuestionOption } from "../hooks/use-chat/schema";

/** 用户对工具提问的标准提交结构。 */
export interface AskUserQuestionAnswer {
  selectedOptions: string[];
  customInput: string | null;
}

/** 按后端选项顺序过滤并去重用户选择。 */
export function orderSelectedOptions(
  options: (AskUserQuestionOption | string)[],
  selectedOptions: readonly string[],
): string[] {
  const selectedSet = new Set(selectedOptions);
  return options
    .filter((option) => selectedSet.has((typeof option === 'string' ? option : option.text)))
    .map((option) => (typeof option === 'string' ? option : option.text));
}

/** 获取问题初次展示时应默认选中的推荐项。 */
export function getRecommendedOptions(
  options: (AskUserQuestionOption | string)[],
  multiple: boolean,
): string[] {
  const recommendedOptions = options
    .filter((option) => (typeof option !== 'string' && option.recommended))
    .map((option) => (typeof option === 'string' ? option : option.text));
  return multiple ? recommendedOptions : recommendedOptions.slice(0, 1);
}

/**
 * 组装最终提交的回答。自定义回答与预设选项互斥，并始终使用独立字段提交。
 */
export function buildAskUserQuestionAnswer(
  options: (AskUserQuestionOption | string)[],
  selectedOptions: readonly string[],
  customInput: string,
): AskUserQuestionAnswer {
  const customAnswer = customInput.trim();

  if (customAnswer) {
    return { selectedOptions: [], customInput: customAnswer };
  }

  return {
    selectedOptions: orderSelectedOptions(options, selectedOptions),
    customInput: null,
  };
}

/** 校验回答是否满足单一来源及单选/多选约束。 */
export function isValidAskUserQuestionAnswer(
  options: (AskUserQuestionOption | string)[],
  answer: AskUserQuestionAnswer,
  multiple: boolean,
): boolean {
  if (answer.customInput) return answer.selectedOptions.length === 0;
  return isValidSelectedOptions(options, answer.selectedOptions, multiple);
}

/** 切换多选项，并保持提交顺序与后端选项列表一致。 */
export function toggleSelectedOption(
  options: (AskUserQuestionOption | string)[],
  selectedOptions: readonly string[],
  text: string,
  checked: boolean,
): string[] {
  const nextSelected = new Set(selectedOptions);
  if (checked) nextSelected.add(text);
  else nextSelected.delete(text);
  return orderSelectedOptions(options, [...nextSelected]);
}

/** 校验待提交选择是否符合当前问题的单选或多选约束。 */
export function isValidSelectedOptions(
  options: (AskUserQuestionOption | string)[],
  selectedOptions: readonly string[],
  multiple: boolean,
): boolean {
  const ordered = orderSelectedOptions(options, selectedOptions);
  if (ordered.length !== selectedOptions.length || ordered.length === 0)
    return false;
  return multiple || ordered.length === 1;
}
