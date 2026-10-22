export type InputSuggestionTrigger = "/" | "@" | "#" | "$";

export type ActiveInputSyntax = {
  trigger: InputSuggestionTrigger;
  start: number;
  end: number;
  query: string;
};

const INPUT_SUGGESTION_TRIGGERS = new Set<InputSuggestionTrigger>([
  "/",
  "@",
  "#",
  "$",
]);

function isWhitespace(value: string | undefined) {
  return value === undefined || /\s/.test(value);
}

/** 根据光标位置识别当前正在编辑的能力语法 token。 */
export function findActiveInputSyntax(
  value: string,
  selectionStart: number | null,
  selectionEnd = selectionStart,
): ActiveInputSyntax | null {
  if (
    selectionStart === null ||
    selectionEnd === null ||
    selectionStart !== selectionEnd ||
    selectionStart < 0 ||
    selectionStart > value.length
  ) {
    return null;
  }

  const cursor = selectionStart;
  let start = cursor;
  while (start > 0 && !isWhitespace(value[start - 1])) {
    start -= 1;
  }

  let end = cursor;
  while (end < value.length && !isWhitespace(value[end])) {
    end += 1;
  }

  const token = value.slice(start, end);
  const trigger = token[0] as InputSuggestionTrigger | undefined;
  if (!trigger || !INPUT_SUGGESTION_TRIGGERS.has(trigger)) {
    return null;
  }

  return {
    trigger,
    start,
    end,
    query: token.slice(1),
  };
}

/** 删除已选择的语法 token，并尽量避免留下多余空白。 */
export function removeInputSyntaxToken(
  value: string,
  token: ActiveInputSyntax,
): { value: string; cursor: number } {
  const before = value.slice(0, token.start);
  const after = value.slice(token.end);

  if (before.length === 0) {
    const next = /^\s/.test(after) ? after.slice(1) : after;
    return { value: next, cursor: 0 };
  }

  if (after.length === 0) {
    const next = /\s$/.test(before) ? before.slice(0, -1) : before;
    return { value: next, cursor: next.length };
  }

  const next =
    /\s$/.test(before) && /^\s/.test(after)
      ? `${before}${after.slice(1)}`
      : `${before}${after}`;
  return { value: next, cursor: before.length };
}
