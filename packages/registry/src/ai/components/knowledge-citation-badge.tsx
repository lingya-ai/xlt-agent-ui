"use client";

import { BookOpenTextIcon } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { cn } from "../../ui/lib/utils";

import {
  type CitationKey,
  useCitationContext,
} from "../hooks/use-chat/citation-context";
import { InlineCitation } from "./inline-citation";

export type KnowledgeCitationBadgeProps = {
  /** 逗号分隔的引用 key，如 "chunk:123,entity:456" */
  dataKeys: string;
  className?: string;
};

/**
 * 知识库行内引用。
 *
 * 使用当前助手回复内稳定的引用编号，点击后打开包含全部引用的侧边栏。
 *
 * @author 思追(shaco)
 */
export function KnowledgeCitationBadge({
  dataKeys,
  className,
}: KnowledgeCitationBadgeProps) {
  const t = useAgentMessages("knowledge-citation-badge");
  const { citationNumberMap, openCitationSheet } = useCitationContext();

  const keys = dataKeys.split(",").filter(Boolean) as CitationKey[];
  const numbers = keys
    .map((key) => citationNumberMap.get(key))
    .filter((number): number is number => number != null);
  const numberText = numbers.length > 0 ? numbers.join(",") : "?";
  const visibleLabel = `[${numberText}]`;

  return (
    <InlineCitation className={className}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t.openReferences({ numbers: visibleLabel }).value}
        className={cn(
          "ml-0.5 inline-flex cursor-pointer items-center gap-0.5 rounded-sm border border-transparent",
          "px-1 py-0.5 align-baseline font-mono text-[10px] font-medium leading-none text-muted-foreground",
          "transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
        onClick={() => openCitationSheet(keys)}
      >
        <BookOpenTextIcon aria-hidden="true" className="size-2.5" />
        <span>{visibleLabel}</span>
      </button>
    </InlineCitation>
  );
}
