"use client";

import { useEffect, useState } from "react";
import {
  BookOpenTextIcon,
  FileTextIcon,
  LightbulbIcon,
  NetworkIcon,
  UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAgentMessages } from "../../i18n/runtime";

import { Badge } from "../../ui/components/badge";
import { ScrollArea } from "../../ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../ui/components/sheet";
import { Skeleton } from "../../ui/components/skeleton";
import { cn } from "../../ui/lib/utils";

import {
  type CitationKey,
  type CitationMetadata,
  citationKeyToReference,
  useCitationContext,
} from "../hooks/use-chat/citation-context";
import { KnowledgeCitationType } from "../hooks/use-chat/schema";

export interface KnowledgeCitationSheetProps {
  open: boolean;
  activeKeys: CitationKey[];
  onOpenChange: (open: boolean) => void;
}

const TYPE_ICON: Record<KnowledgeCitationType, LucideIcon> = {
  [KnowledgeCitationType.CHUNK]: FileTextIcon,
  [KnowledgeCitationType.ENTITY]: NetworkIcon,
  [KnowledgeCitationType.COMMUNITY]: UsersIcon,
  [KnowledgeCitationType.CLAIM]: LightbulbIcon,
};

/**
 * 将后端元数据转换回 CitationKey，便于与上下文引用对应。
 */
function metadataToCitationKey(metadata: CitationMetadata): CitationKey | null {
  const type = metadata.type.toUpperCase();
  if (
    !Object.values(KnowledgeCitationType).includes(
      type as KnowledgeCitationType,
    )
  ) {
    return null;
  }
  return `${type.toLowerCase()}:${metadata.referenceId}` as CitationKey;
}

function ReferenceSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

function CitationTypeLabel({
  type,
}: {
  type: KnowledgeCitationType;
}): React.ReactElement {
  const t = useAgentMessages("knowledge-citation-sheet");

  switch (type) {
    case KnowledgeCitationType.CHUNK:
      return <>{t.typeChunk}</>;
    case KnowledgeCitationType.ENTITY:
      return <>{t.typeEntity}</>;
    case KnowledgeCitationType.COMMUNITY:
      return <>{t.typeCommunity}</>;
    case KnowledgeCitationType.CLAIM:
      return <>{t.typeClaim}</>;
  }
}

function CitationReferenceCard({
  citationKey,
  number,
  metadata,
  active,
}: {
  citationKey: CitationKey;
  number: number;
  metadata?: CitationMetadata;
  active: boolean;
}): React.ReactElement {
  const t = useAgentMessages("knowledge-citation-sheet");
  const [typeValue] = citationKey.split(":");
  const type = typeValue!.toUpperCase() as KnowledgeCitationType;
  const Icon = TYPE_ICON[type];
  const showTitle =
    type !== KnowledgeCitationType.CHUNK &&
    type !== KnowledgeCitationType.CLAIM;

  return (
    <article
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-lg border bg-background p-4 transition-colors",
        active ? "border-primary bg-muted" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <Badge
          variant="outline"
          className={cn(
            "h-7 min-w-7 shrink-0 rounded-md px-1.5 font-mono text-xs",
            active && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {number}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Icon aria-hidden="true" className="size-3.5" />
              <CitationTypeLabel type={type} />
            </span>
            {active && (
              <Badge className="border-transparent bg-primary text-primary-foreground">
                {t.currentLabel}
              </Badge>
            )}
          </div>
          {showTitle && (
            <h3 className="mt-2 break-words text-sm font-semibold leading-5 text-foreground">
              {metadata?.title || t.fallbackTitle({ number })}
            </h3>
          )}
          <p
            className={cn(
              "whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground",
              showTitle ? "mt-1.5" : "mt-2",
            )}
          >
            {metadata?.description || t.detailUnavailable}
          </p>
        </div>
      </div>
    </article>
  );
}

function CitationSection({
  title,
  keys,
  active,
  allKeys,
  metadataMap,
  citationNumberMap,
}: {
  title: React.ReactNode;
  keys: CitationKey[];
  active: boolean;
  allKeys: CitationKey[];
  metadataMap: Map<CitationKey, CitationMetadata>;
  citationNumberMap: Map<CitationKey, number>;
}): React.ReactElement | null {
  if (keys.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {keys.map((key) => (
        <CitationReferenceCard
          key={key}
          citationKey={key}
          number={citationNumberMap.get(key) ?? allKeys.indexOf(key) + 1}
          metadata={metadataMap.get(key)}
          active={active}
        />
      ))}
    </section>
  );
}

/**
 * 当前助手回复的完整引用列表。
 *
 * 点击行内引用后从右侧打开，并将触发位置关联的引用置顶、高亮。
 */
export function KnowledgeCitationSheet({
  open,
  activeKeys,
  onOpenChange,
}: KnowledgeCitationSheetProps): React.ReactElement {
  const t = useAgentMessages("knowledge-citation-sheet");
  const { citationNumberMap, fetchMetadata } = useCitationContext();
  const [metadataMap, setMetadataMap] = useState<
    Map<CitationKey, CitationMetadata>
  >(new Map());
  const [loading, setLoading] = useState(false);

  const allKeys = Array.from(
    new Set([...citationNumberMap.keys(), ...activeKeys]),
  );
  const citationKeySignature = allKeys.join(",");

  useEffect(() => {
    if (!open) {
      return;
    }

    const keys = citationKeySignature
      .split(",")
      .filter(Boolean) as CitationKey[];
    if (keys.length === 0) {
      setMetadataMap(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const loadMetadata = async () => {
      try {
        const metadataList = await fetchMetadata(
          keys.map(citationKeyToReference),
        );
        if (cancelled) {
          return;
        }

        const nextMetadataMap = new Map<CitationKey, CitationMetadata>();
        for (const metadata of metadataList) {
          const key = metadataToCitationKey(metadata);
          if (key != null) {
            nextMetadataMap.set(key, metadata);
          }
        }
        setMetadataMap(nextMetadataMap);
      } catch {
        if (!cancelled) {
          // 保留引用编号与类型，单条详情降级为“暂不可用”。
          setMetadataMap(new Map());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [open, citationKeySignature, fetchMetadata]);

  const activeKeySet = new Set(activeKeys);
  const currentKeys = allKeys.filter((key) => activeKeySet.has(key));
  const otherKeys = allKeys.filter((key) => !activeKeySet.has(key));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[92vw] gap-0 p-0 sm:w-1/2 sm:max-w-none"
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <div className="flex items-center gap-2">
            <BookOpenTextIcon
              aria-hidden="true"
              className="size-5 text-primary"
            />
            <SheetTitle>{t.title}</SheetTitle>
          </div>
          <SheetDescription>
            {t.description({
              count: allKeys.length,
              activeCount: currentKeys.length,
            })}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1" overflowXHidden>
          <div className="space-y-6 p-5">
            {allKeys.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t.empty}
              </div>
            ) : loading && metadataMap.size === 0 ? (
              <div aria-label={t.loadingLabel.value} className="space-y-3">
                <ReferenceSkeleton />
                <ReferenceSkeleton />
                <ReferenceSkeleton />
              </div>
            ) : (
              <>
                <CitationSection
                  title={t.currentSection}
                  keys={currentKeys}
                  active
                  allKeys={allKeys}
                  metadataMap={metadataMap}
                  citationNumberMap={citationNumberMap}
                />
                <CitationSection
                  title={t.otherSection}
                  keys={otherKeys}
                  active={false}
                  allKeys={allKeys}
                  metadataMap={metadataMap}
                  citationNumberMap={citationNumberMap}
                />
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
