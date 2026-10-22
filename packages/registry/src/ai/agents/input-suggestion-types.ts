import type { ReactNode } from "react";
import type { InputSuggestionTrigger } from "./input-syntax";

export type AgentsChatInputSuggestionItem = {
  id: string;
  label: ReactNode;
  searchText: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  focusInputAfterSelect?: boolean;
  /** 目标表单在成功后才消费命令，取消时继续保留草稿。 */
  preserveInputSyntax?: boolean;
  onSelect: () => void;
};

export type AgentsChatInputSuggestionGroup = {
  id: string;
  label: ReactNode;
  triggers: readonly InputSuggestionTrigger[];
  items: readonly AgentsChatInputSuggestionItem[];
};

export type AgentsChatInputSuggestions = {
  groups: readonly AgentsChatInputSuggestionGroup[];
};
