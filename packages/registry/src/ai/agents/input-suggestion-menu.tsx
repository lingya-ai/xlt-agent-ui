"use client";

import { useLayoutEffect, useRef } from "react";
import { CheckIcon } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../ui/components/command";
import {
  InputMenuSource,
  type useInputSuggestionMenu,
} from "./use-input-suggestion-menu";

interface InputSuggestionMenuProps {
  menu: ReturnType<typeof useInputSuggestionMenu>;
}

/** 菜单只负责展示；草稿、键盘选择和动作执行统一由交互 Hook 管理。 */
export function InputSuggestionMenu({ menu }: InputSuggestionMenuProps) {
  const t = useAgentMessages("input-suggestion-menu");
  const listRef = useRef<HTMLDivElement>(null);

  const { setAccessibility } = menu;
  useLayoutEffect(() => {
    const selected = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[cmdk-item]") ?? [],
    ).find((item) => item.getAttribute("data-value") === menu.activeItem?.id);
    selected?.scrollIntoView({ block: "nearest" });
    // cmdk 自己生成并覆盖列表与选项 ID，外部 textarea 必须引用实际 DOM ID。
    const listId = listRef.current?.id;
    const activeItemId = selected?.id;
    setAccessibility((current) =>
      current.listId === listId && current.activeItemId === activeItemId
        ? current
        : { listId, activeItemId },
    );
  }, [menu.activeItem?.id, setAccessibility]);

  return (
    <Command
      label={
        menu.source === InputMenuSource.Button ? t.search.value : t.label.value
      }
      shouldFilter={false}
      value={menu.activeItem?.id ?? ""}
      onValueChange={menu.setActiveItem}
      onKeyDownCapture={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
          event.stopPropagation();
          return;
        }
        menu.handleKeyDown(event);
        if (event.defaultPrevented) event.stopPropagation();
      }}
    >
      {menu.source === InputMenuSource.Button && (
        <CommandInput
          autoFocus
          aria-label={t.search.value}
          placeholder={t.search.value}
          value={menu.search}
          onValueChange={menu.setSearch}
        />
      )}
      <CommandList
        label={t.label.value}
        ref={listRef}
        className="max-h-[min(20rem,50vh)]"
      >
        {menu.visibleGroups.map((group) => (
          <CommandGroup heading={group.label} key={group.id}>
            {group.items.map((item) => (
              <CommandItem
                disabled={item.disabled}
                key={item.id}
                value={item.id}
                onMouseDown={(event) => event.preventDefault()}
                onSelect={() => menu.select(item)}
              >
                {item.icon}
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.trailing && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.trailing}
                  </span>
                )}
                {item.selected && (
                  <>
                    <CheckIcon aria-hidden="true" />
                    <span className="sr-only">{t.selected}</span>
                  </>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {menu.visibleGroups.length === 0 && (
          <CommandEmpty>
            {menu.hasCandidates ? t.noResults : t.empty}
          </CommandEmpty>
        )}
      </CommandList>
    </Command>
  );
}
