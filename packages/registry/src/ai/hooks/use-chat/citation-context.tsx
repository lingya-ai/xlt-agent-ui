"use client";

import { createContext, useContext } from "react";

import { splitCitationText } from "../../lib/citation-utils";
import {AiChatEventTypeEnum, type KnowledgeCitation, KnowledgeCitationType} from "./schema";
import type { AssistantChatMessage } from "./types";

/**
 * 引用 key 格式："chunk:123"、"entity:456" 等
 */
export type CitationKey = `${Lowercase<KnowledgeCitationType>}:${number}`;

/**
 * 根据 KnowledgeCitation 生成唯一 key
 */


/**
 * 将引用 key 转换为元数据接口所需的引用参数。
 */
export function citationKeyToReference(key: CitationKey): KnowledgeCitation {
  const [type, referenceId] = key.split(':');
  return {type: type!.toUpperCase(), referenceId: Number(referenceId)};
}

/** 引用元数据（从后端获取的 title / description） */
import type {CitationMetadata} from '@lingya-ai/agents-sdk/browser';
export type {CitationMetadata} from '@lingya-ai/agents-sdk/browser';

export interface CitationContextType {
  /** "chunk:123" → KnowledgeCitation */
  citationMap: Map<CitationKey, KnowledgeCitation>;
  /** 引用在当前助手回复中的稳定展示编号 */
  citationNumberMap: Map<CitationKey, number>;
  /** 打开当前助手回复的引用列表，并标记本处引用 */
  openCitationSheet: (keys: CitationKey[]) => void;
  /** 从后端批量获取引用元数据（由使用方注入实现） */
  fetchMetadata: (
    references: KnowledgeCitation[],
  ) => Promise<CitationMetadata[]>;
}

/**
 * 知识库引用数据 Context
 *
 * 提供引用数据的增量累积，
 * 供 CitationMessageResponse 和 KnowledgeCitationBadge 使用。
 *
 * @author 思追(shaco)
 */
export const CitationContext = createContext<CitationContextType>({
  citationMap: new Map(),
  citationNumberMap: new Map(),
  openCitationSheet: () => undefined,
  fetchMetadata: async () => [],
});

export function useCitationContext(): CitationContextType {
  return useContext(CitationContext);
}

/**
 * 从助手事件数组中提取引用数据。
 *
 * 引用数据用 useRef 增量累积，仅处理新增的 ToolExecution 事件。
 * 编号按引用在回答正文中首次出现的顺序生成，同一引用始终复用同一编号。
 *
 * @param assistant - 助手消息事件列表
 * @param fetchMetadata - 从后端获取引用元数据的回调
 * @param openCitationSheet - 打开引用列表的回调
 * @returns CitationContextType
 */
export function useCitationData(
  assistant: AssistantChatMessage[],
  fetchMetadata: CitationContextType["fetchMetadata"],
  openCitationSheet: CitationContextType["openCitationSheet"],
): CitationContextType {
  const citationMap = new Map<CitationKey, KnowledgeCitation>();
  const citationNumberMap = new Map<CitationKey, number>();
  for (const event of assistant) {
    if ("rawJson" in event || event.type !== AiChatEventTypeEnum.Message) {
      continue;
    }

    for (const part of splitCitationText(event.message)) {
      if (part.kind !== "citation") {
        continue;
      }

      for (const key of part.keys as CitationKey[]) {
        if (!citationNumberMap.has(key)) {
          citationNumberMap.set(key, citationNumberMap.size + 1);
          citationMap.set(key, citationKeyToReference(key));
        }
      }
    }
  }

  return {
    citationMap,
    citationNumberMap,
    openCitationSheet,
    fetchMetadata,
  };
}
