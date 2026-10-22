import { describe, expect, it } from "vitest";

import {
  getContextCompactionCommandState,
  shouldAutomaticallyLoadContextUsage,
} from "./context-compaction-command";

describe("上下文压缩命令", () => {
  it("新会话、生成中和首次读取时均禁用", () => {
    expect(
      getContextCompactionCommandState({
        isResponding: false,
        usagePending: false,
        canCompact: true,
      }),
    ).toEqual({ disabled: true, status: "NO_CONTEXT" });
    expect(
      getContextCompactionCommandState({
        conversationId: "c1",
        isResponding: true,
        usagePending: false,
        canCompact: true,
      }),
    ).toEqual({ disabled: true, status: "RESPONDING" });
    expect(
      getContextCompactionCommandState({
        conversationId: "c1",
        isResponding: false,
        usagePending: true,
        canCompact: true,
      }),
    ).toEqual({ disabled: true, status: "LOADING" });
  });

  it("用量比例不可计算时仍由压缩能力决定是否可用", () => {
    expect(
      getContextCompactionCommandState({
        conversationId: "c1",
        isResponding: false,
        usagePending: false,
        canCompact: true,
      }),
    ).toEqual({ disabled: false, status: "READY" });
  });
});

describe("上下文用量自动查询", () => {
  it("显示开关关闭时不自动查询", () => {
    expect(
      shouldAutomaticallyLoadContextUsage({
        conversationId: "c1",
        readOnly: false,
        showContextWindowUsage: false,
      }),
    ).toBe(false);
  });

  it("仅对开启显示的可编辑既有会话自动查询", () => {
    expect(
      shouldAutomaticallyLoadContextUsage({
        conversationId: "c1",
        readOnly: false,
        showContextWindowUsage: true,
      }),
    ).toBe(true);
    expect(
      shouldAutomaticallyLoadContextUsage({
        conversationId: "c1",
        readOnly: true,
        showContextWindowUsage: true,
      }),
    ).toBe(false);
  });
});
