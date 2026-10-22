import {describe, expect, it} from "vitest";
import {resolveConversationExecutionType} from "./conversation-execution-type";

describe("会话执行类型解析", () => {
  it.each([
    [undefined, undefined, "USER_MESSAGE"],
    [undefined, "ASYNC_TASK_NOTIFICATION", "ASYNC_TASK_NOTIFICATION"],
    ["SUBAGENT", undefined, "SUBAGENT"],
    ["ASYNC_TASK_NOTIFICATION", "USER_MESSAGE", "ASYNC_TASK_NOTIFICATION"],
    ["USER_MESSAGE", "ASYNC_TASK_NOTIFICATION", "USER_MESSAGE"],
    ["FUTURE_TYPE", "USER_MESSAGE", "FUTURE_TYPE"],
  ])("嵌套类型 %s 和外层类型 %s 解析为 %s", (nested, outer, expected) => {
    expect(resolveConversationExecutionType(nested === undefined ? undefined : {executionType: nested}, outer))
      .toBe(expected);
  });
});
