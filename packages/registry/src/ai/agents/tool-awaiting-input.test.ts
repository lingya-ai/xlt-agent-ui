// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AskUserQuestionOption } from "../hooks/use-chat/schema";
import type { AskUserQuestionAnswer } from "../lib/ask-user-question";
import {
  ToolAwaitingInput,
  type ToolAwaitingInputProps,
} from "./tool-awaiting-input";

const mocks = vi.hoisted(() => ({
  fetchStatus: vi.fn(),
}));

vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () => ({
    checkingStatus: "正在确认问题状态…",
    interrupted: "已中断",
    recommended: "推荐",
    unavailable: "该问题已无法继续回答，请刷新本轮消息查看最新状态",
    statusFailed: "无法确认问题状态，提交已保持禁用",
    retryStatus: "重新确认状态",
    submitFailed: "回答提交失败",
  }),
}));

vi.mock("../../api/hooks/use-api-request", () => ({
  useApiRequest: (service: (...args: unknown[]) => unknown) => ({
    runAsync: (...args: unknown[]) => service(...args),
  }),
}));

vi.mock("../../ui/components/sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../hooks/use-chat/use-hitl", () => ({
  useFetchUserInputStatus: () => mocks.fetchStatus,
}));

vi.mock("./context", () => ({
  useAiChatContext: () => ({ httpClient: {} }),
}));

vi.mock("../components/ask", () => ({
  Ask: ({
    onAnswer,
  }: {
    children?: ReactNode;
    onAnswer: (answer: AskUserQuestionAnswer) => Promise<void> | void;
  }) =>
    createElement(
      "button",
      {
        type: "button",
        onClick: () =>
          void onAnswer({
            selectedOptions: ["选项A：继续测试"],
            customInput: null,
          }),
      },
      "提交测试答案",
    ),
  AskDetails: () => null,
  AskFooter: () => null,
  AskOptions: () => null,
  AskTitle: () => null,
}));

const options: AskUserQuestionOption[] = [
  { text: "选项A：继续测试", recommended: true },
  { text: "选项B：结束测试", recommended: false },
];

const baseProps: ToolAwaitingInputProps = {
  conversationId: "conversation-1",
  messageId: "message-1",
  questionId: "question-1",
  question: "是否继续？",
  questionDetails: "请选择一项",
  options,
  multiple: false,
  serverNow: "2026-09-12T10:52:53.781Z",
  timeoutSeconds: 1_800,
  interrupted: false,
  onAnswer: vi.fn().mockResolvedValue({ success: true }),
};

beforeEach(() => {
  mocks.fetchStatus.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("工具等待用户输入终态", () => {
  it("刷新后消息已中断时直接展示中断终态", () => {
    render(
      createElement(ToolAwaitingInput, { ...baseProps, interrupted: true }),
    );

    expect(screen.getByText("是否继续？")).toBeTruthy();
    expect(screen.getByText("请选择一项")).toBeTruthy();
    expect(screen.getByText("选项A：继续测试")).toBeTruthy();
    expect(screen.getByText("选项B：结束测试")).toBeTruthy();
    expect(screen.getByText("推荐")).toBeTruthy();
    expect(
      screen
        .getByText("选项A：继续测试")
        .parentElement?.getAttribute("data-selected"),
    ).toBe("false");
    expect(
      screen
        .getByText("选项B：结束测试")
        .parentElement?.getAttribute("data-selected"),
    ).toBe("false");
    expect(screen.getByText("已中断")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "提交测试答案" })).toBeNull();
    expect(mocks.fetchStatus).not.toHaveBeenCalled();
  });

  it("中断后忽略已发出的问题状态查询结果", async () => {
    let resolveStatus:
      | ((value: {
          pending: true;
          question: string;
          questionDetails: string;
          options: AskUserQuestionOption[];
          multiple: boolean;
        }) => void)
      | undefined;
    mocks.fetchStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );
    const view = render(createElement(ToolAwaitingInput, baseProps));
    await waitFor(() => expect(mocks.fetchStatus).toHaveBeenCalledTimes(1));

    view.rerender(
      createElement(ToolAwaitingInput, { ...baseProps, interrupted: true }),
    );
    expect(screen.getByText("已中断")).toBeTruthy();

    await act(async () => {
      resolveStatus?.({
        pending: true,
        question: "服务端问题",
        questionDetails: "服务端详情",
        options: [
          { text: "选项A", recommended: true },
          { text: "选项B", recommended: false },
        ],
        multiple: false,
      });
      await Promise.resolve();
    });

    expect(screen.getByText("已中断")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "提交测试答案" })).toBeNull();
  });

  it("本地回答提交成功后优先展示已回答结果", async () => {
    mocks.fetchStatus.mockResolvedValue({
      pending: true,
      question: baseProps.question,
      questionDetails: baseProps.questionDetails,
      options: [
        { text: "选项A", recommended: true },
        { text: "选项B", recommended: false },
      ],
      multiple: false,
    });
    const onAnswer = vi.fn().mockResolvedValue({ success: true });
    const view = render(
      createElement(ToolAwaitingInput, { ...baseProps, onAnswer }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "提交测试答案" }),
    );
    expect(await screen.findByText("选项A：继续测试")).toBeTruthy();
    expect(screen.getByText("选项B：结束测试")).toBeTruthy();
    expect(screen.queryByText("选项A")).toBeNull();
    expect(screen.queryByText("选项B")).toBeNull();
    expect(
      screen
        .getByText("选项A：继续测试")
        .parentElement?.getAttribute("data-selected"),
    ).toBe("true");
    expect(
      screen
        .getByText("选项B：结束测试")
        .parentElement?.getAttribute("data-selected"),
    ).toBe("false");
    expect(onAnswer).toHaveBeenCalledTimes(1);

    view.rerender(
      createElement(ToolAwaitingInput, {
        ...baseProps,
        interrupted: true,
        onAnswer,
      }),
    );

    expect(screen.getByText("选项A：继续测试")).toBeTruthy();
    expect(screen.queryByText("已中断")).toBeNull();
  });

  it("服务端回答扩展存在时优先展示已回答结果", () => {
    render(
      createElement(ToolAwaitingInput, {
        ...baseProps,
        interrupted: true,
        selectedOptions: ["选项B：结束测试"],
      }),
    );

    expect(screen.getByText("选项B：结束测试")).toBeTruthy();
    expect(screen.getByText("选项A：继续测试")).toBeTruthy();
    expect(screen.queryByText("已中断")).toBeNull();
    expect(mocks.fetchStatus).not.toHaveBeenCalled();
  });

  it("非中断消息 pending 为 false 时保留不可用提示", async () => {
    mocks.fetchStatus.mockResolvedValue({ pending: false });
    render(createElement(ToolAwaitingInput, baseProps));

    expect(
      await screen.findByText(
        "该问题已无法继续回答，请刷新本轮消息查看最新状态",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("已中断")).toBeNull();
  });
});
