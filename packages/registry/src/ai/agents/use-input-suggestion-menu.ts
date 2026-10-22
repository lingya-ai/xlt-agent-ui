"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import {
  findActiveInputSyntax,
  removeInputSyntaxToken,
  type ActiveInputSyntax,
} from "./input-syntax";
import type {
  AgentsChatInputSuggestionGroup,
  AgentsChatInputSuggestionItem,
} from "./input-suggestion-types";

export enum InputMenuSource {
  Button = "button",
  Syntax = "syntax",
}

type Cursor = { start: number; end: number };

function getSyntaxKey(syntax: ActiveInputSyntax | null) {
  return syntax
    ? `${syntax.trigger}:${syntax.start}:${syntax.end}:${syntax.query}`
    : null;
}

interface InputSuggestionMenuOptions {
  groups: readonly AgentsChatInputSuggestionGroup[];
  text: string;
  onTextChange: (text: string) => void;
  cursor: Cursor;
  onCursorChange: (cursor: Cursor) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  conversationId?: string;
}

/** 让按钮菜单和输入语法共享筛选、执行与焦点恢复，同时隔离菜单搜索和消息草稿。 */
export function useInputSuggestionMenu({
  groups,
  text,
  onTextChange,
  cursor,
  onCursorChange,
  textareaRef,
  conversationId,
}: InputSuggestionMenuOptions) {
  const [buttonOpen, setButtonOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const focusFrame = useRef<number | null>(null);
  const previousConversation = useRef(conversationId);
  const [accessibility, setAccessibility] = useState<{
    listId?: string;
    activeItemId?: string;
  }>({});
  const activeSyntax = findActiveInputSyntax(text, cursor.start, cursor.end);
  const syntaxKey = getSyntaxKey(activeSyntax);
  const source = buttonOpen ? InputMenuSource.Button : InputMenuSource.Syntax;
  const trigger = buttonOpen ? "/" : activeSyntax?.trigger;
  const candidateGroups = groups.filter(
    (group) => trigger && group.triggers.includes(trigger),
  );
  const query = (buttonOpen ? search : (activeSyntax?.query ?? ""))
    .trim()
    .toLocaleLowerCase();
  const visibleGroups = candidateGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !query || item.searchText.toLocaleLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const selectableItems = visibleGroups
    .flatMap((group) => group.items)
    .filter((item) => !item.disabled);
  const activeItem =
    selectableItems[Math.min(activeIndex, selectableItems.length - 1)];
  const open = buttonOpen || (syntaxKey !== null && syntaxKey !== dismissedKey);

  const cancelFocus = () => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = null;
  };

  const restoreFocus = (selection = cursor) => {
    cancelFocus();
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      textareaRef.current?.focus({ preventScroll: true });
      textareaRef.current?.setSelectionRange(selection.start, selection.end);
    });
  };

  const dismiss = (restore = true) => {
    setButtonOpen(false);
    setSearch("");
    setDismissedKey(syntaxKey);
    if (restore) restoreFocus();
  };

  const select = (item: AgentsChatInputSuggestionItem) => {
    if (item.disabled) return;
    let selection = cursor;
    let nextDismissedKey = syntaxKey;
    if (!buttonOpen && activeSyntax && !item.preserveInputSyntax) {
      const next = removeInputSyntaxToken(text, activeSyntax);
      onTextChange(next.value);
      selection = { start: next.cursor, end: next.cursor };
      onCursorChange(selection);
      nextDismissedKey = getSyntaxKey(
        findActiveInputSyntax(next.value, next.cursor),
      );
    }
    dismiss(false);
    // 移除 token 后光标可能恰好位于另一个命令之前，本次选择仍应关闭菜单。
    setDismissedKey(nextDismissedKey);
    // 必须保留在用户事件调用栈中，附件选择器才能获得浏览器的用户激活权限。
    item.onSelect();
    if (item.focusInputAfterSelect !== false) restoreFocus(selection);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (selectableItems.length) {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex(
          (index) =>
            (Math.min(index, selectableItems.length - 1) +
              direction +
              selectableItems.length) %
            selectableItems.length,
        );
      }
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (activeItem) select(activeItem);
    } else if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
    }
  };

  useEffect(() => {
    setActiveIndex(0);
    setDismissedKey((current) => (current === syntaxKey ? current : null));
  }, [syntaxKey, search, buttonOpen]);
  useEffect(() => {
    if (previousConversation.current === conversationId) return;
    previousConversation.current = conversationId;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    setButtonOpen(false);
    setSearch("");
    setDismissedKey(syntaxKey);
    setActiveIndex(0);
  }, [conversationId, syntaxKey]);
  useEffect(
    () => () => {
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    },
    [],
  );

  return {
    open,
    source,
    trigger,
    search,
    activeSyntax,
    activeItem,
    visibleGroups,
    ...accessibility,
    setAccessibility,
    hasCandidates: candidateGroups.some((group) => group.items.length > 0),
    setSearch,
    select,
    dismiss,
    handleKeyDown,
    toggle: () => {
      if (buttonOpen) {
        dismiss();
        return;
      }
      cancelFocus();
      setSearch("");
      setButtonOpen(true);
    },
    setActiveItem: (id: string) => {
      const index = selectableItems.findIndex((item) => item.id === id);
      if (index >= 0) setActiveIndex(index);
    },
  };
}
