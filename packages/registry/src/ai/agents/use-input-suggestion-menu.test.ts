// @vitest-environment jsdom
import React, { createElement, useRef, useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InputSuggestionMenu } from "./input-suggestion-menu";
import { useInputSuggestionMenu } from "./use-input-suggestion-menu";
import type { AgentsChatInputSuggestionGroup } from "./input-suggestion-types";

vi.hoisted(() => {
  const Encoder = globalThis.TextEncoder;
  globalThis.TextEncoder = class extends Encoder {
    encode(input?: string) {
      return new Uint8Array(super.encode(input));
    }
  };
});
vi.stubGlobal("React", React);
vi.mock("../../i18n/runtime", () => ({
  useAgentMessages: () =>
    new Proxy(
      {},
      {
        get: (_, key) => ({
          ...createElement("span", null, String(key)),
          value: String(key),
        }),
      },
    ),
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Element.prototype.scrollIntoView = vi.fn();

const selectSkill = vi.fn();
const selectKnowledge = vi.fn();
const selectTool = vi.fn();
const openGoal = vi.fn();
const disabledAction = vi.fn();

function Harness({
  conversationId = "first",
  disabled = false,
}: {
  conversationId?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState({ start: 0, end: 0 });
  const [selected, setSelected] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const groups: AgentsChatInputSuggestionGroup[] = [
    {
      id: "actions",
      label: "actions",
      triggers: ["/"],
      items: [
        {
          id: "disabled",
          label: "disabled",
          searchText: "disabled",
          disabled: true,
          onSelect: disabledAction,
        },
      ],
    },
    {
      id: "skills",
      label: "skills",
      triggers: ["/", "@"],
      items: [
        {
          id: "skill",
          label: "Skill Alpha",
          searchText: "skill alpha 技能",
          selected,
          disabled,
          onSelect: () => {
            setSelected(!selected);
            selectSkill();
          },
        },
      ],
    },
    {
      id: "knowledge",
      label: "knowledge",
      triggers: ["/", "#"],
      items: [
        {
          id: "knowledge-a",
          label: "Knowledge Alpha",
          searchText: "knowledge alpha",
          onSelect: selectKnowledge,
        },
      ],
    },
    {
      id: "tools",
      label: "tools",
      triggers: ["/", "$"],
      items: [
        {
          id: "tool-a",
          label: "Tool Alpha",
          searchText: "tool alpha",
          onSelect: selectTool,
        },
      ],
    },
    {
      id: "goals",
      label: "goals",
      triggers: ["/"],
      items: [
        {
          id: "goal",
          label: "Goal",
          searchText: "goal",
          preserveInputSyntax: true,
          focusInputAfterSelect: false,
          onSelect: openGoal,
        },
      ],
    },
  ];
  const menu = useInputSuggestionMenu({
    groups,
    text,
    onTextChange: setText,
    cursor,
    onCursorChange: setCursor,
    textareaRef,
    conversationId,
  });
  return createElement(
    React.Fragment,
    null,
    createElement("textarea", {
      ref: textareaRef,
      "aria-label": "draft",
      value: text,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(event.currentTarget.value);
        setCursor({
          start: event.currentTarget.selectionStart,
          end: event.currentTarget.selectionEnd,
        });
      },
      onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setCursor({
          start: event.currentTarget.selectionStart,
          end: event.currentTarget.selectionEnd,
        });
      },
      onKeyDown: menu.handleKeyDown,
    }),
    createElement("button", { onClick: menu.toggle }, "menu"),
    menu.open && createElement(InputSuggestionMenu, { menu }),
  );
}

const draft = () => screen.getByLabelText<HTMLTextAreaElement>("draft");
const typeDraft = (value: string) =>
  fireEvent.change(draft(), {
    target: { value, selectionStart: value.length, selectionEnd: value.length },
  });
const openMenu = () => fireEvent.click(screen.getByText("menu"));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("统一输入菜单", () => {
  it("按钮搜索独立于草稿，选择后恢复原选区并显示勾选状态", async () => {
    render(createElement(Harness));
    typeDraft("保留这段草稿");
    draft().focus();
    draft().setSelectionRange(2, 4);
    fireEvent.select(draft());
    openMenu();
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "ALPHA" },
    });
    expect(draft().value).toBe("保留这段草稿");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.click(screen.getByText("Skill Alpha"));
    expect(selectSkill).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(draft()));
    expect([draft().selectionStart, draft().selectionEnd]).toEqual([2, 4]);
    openMenu();
    expect(
      screen
        .getByText("Skill Alpha")
        .closest("[cmdk-item]")
        ?.querySelector("svg"),
    ).not.toBeNull();
  });

  it.each([
    ["@", "Skill Alpha"],
    ["#", "Knowledge Alpha"],
    ["$", "Tool Alpha"],
  ])("%s 只显示对应能力，选择仅移除当前 token", async (trigger, label) => {
    render(createElement(Harness));
    typeDraft(`请使用 ${trigger}alpha 完成任务`);
    draft().focus();
    draft().setSelectionRange(6, 6);
    fireEvent.select(draft());
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByText(label));
    expect(draft().value).toBe("请使用 完成任务");
    await waitFor(() => expect(document.activeElement).toBe(draft()));
  });

  it("斜杠平铺全部分组，上下键跳过禁用项，Enter 只执行一次", () => {
    render(createElement(Harness));
    typeDraft("/");
    expect(screen.getAllByRole("option")).toHaveLength(5);
    fireEvent.keyDown(draft(), { key: "ArrowDown" });
    fireEvent.keyDown(draft(), { key: "ArrowUp" });
    fireEvent.keyDown(draft(), { key: "Enter" });
    expect(selectSkill).toHaveBeenCalledTimes(1);
    expect(disabledAction).not.toHaveBeenCalled();
    expect(draft().value).toBe("");
  });

  it("搜索框键盘与鼠标共用执行逻辑，Space 和中文组合输入不执行", () => {
    render(createElement(Harness));
    openMenu();
    const search = screen.getByLabelText("search");
    fireEvent.keyDown(search, { key: " " });
    fireEvent.keyDown(search, { key: "Enter", isComposing: true });
    fireEvent.keyDown(search, { key: "Enter", keyCode: 229 });
    expect(selectSkill).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(selectKnowledge).toHaveBeenCalledTimes(1);
    expect(selectSkill).not.toHaveBeenCalled();
  });

  it("目标选择保留参数草稿，取消后可重新打开；Escape 不再自动弹出", () => {
    render(createElement(Harness));
    typeDraft("/goal 完成报告");
    draft().focus();
    draft().setSelectionRange(5, 5);
    fireEvent.select(draft());
    fireEvent.click(screen.getByText("Goal"));
    expect(openGoal).toHaveBeenCalledTimes(1);
    expect(draft().value).toBe("/goal 完成报告");
    expect(screen.queryByRole("listbox")).toBeNull();
    openMenu();
    fireEvent.keyDown(screen.getByLabelText("search"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(draft().value).toBe("/goal 完成报告");
  });

  it("没有搜索结果时不执行动作，权限更新后禁用项不能选择", () => {
    const view = render(createElement(Harness));
    openMenu();
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "missing" },
    });
    fireEvent.keyDown(screen.getByLabelText("search"), { key: "Enter" });
    expect(screen.queryByRole("option")).toBeNull();
    expect(selectSkill).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "skill" },
    });
    view.rerender(createElement(Harness, { disabled: true }));
    fireEvent.click(screen.getByText("Skill Alpha"));
    expect(selectSkill).not.toHaveBeenCalled();
  });

  it("切换会话关闭按钮与语法菜单，重新打开清空搜索", () => {
    const view = render(createElement(Harness));
    typeDraft("/");
    view.rerender(createElement(Harness, { conversationId: "second" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    openMenu();
    fireEvent.change(screen.getByLabelText("search"), {
      target: { value: "skill" },
    });
    view.rerender(createElement(Harness, { conversationId: "third" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    openMenu();
    expect(screen.getByLabelText<HTMLInputElement>("search").value).toBe("");
  });

  it("Escape 关闭后，重新输入同一斜杠可以再次唤起菜单", () => {
    render(createElement(Harness));
    typeDraft("/");
    fireEvent.keyDown(draft(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    typeDraft("");
    typeDraft("/");
    expect(screen.getByRole("listbox")).toBeDefined();
  });

  it("移除当前 token 后不会自动执行或展开紧邻的下一条命令", () => {
    render(createElement(Harness));
    typeDraft("/alpha /goal");
    draft().focus();
    draft().setSelectionRange(3, 3);
    fireEvent.select(draft());
    fireEvent.click(screen.getByText("Skill Alpha"));
    expect(draft().value).toBe("/goal");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(openGoal).not.toHaveBeenCalled();
  });
});
