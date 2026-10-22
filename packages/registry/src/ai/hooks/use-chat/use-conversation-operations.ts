import {useAiChatRequestSignal} from '../../agents/context';
import type {ConversationGroup, ConversationGroupList, ConversationMetadata, ConversationSummary as ConversationItem, ConversationSummaryList as ConversationPage, ConversationContextUsage, RequestOptions} from '@lingya-ai/agents-sdk/browser';
export type {ConversationGroup, ConversationGroupList, ConversationMetadata, ConversationSummary as ConversationItem, ConversationSummaryList as ConversationPage, ConversationContextUsage} from '@lingya-ai/agents-sdk/browser';
export interface UseConversationOperationsOptions {httpClient: AgentsClient}

import { useCallback } from "react";
import {
  ConversationStatus,
  ConversationQueryStatus,
} from "./conversation-status";
export {
  ConversationStatus,
  ConversationQueryStatus,
} from "./conversation-status";
import { z } from "zod";

import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";



import {
  type ConversationTitle,
} from "./conversation-title";

const pendingContextUsageRequests = new WeakMap<
  object,
  Map<string, Promise<ConversationContextUsage>>
>();

export const conversationStatusSchema = z.nativeEnum(ConversationStatus);

/**
 * 更新会话标题请求
 */
export const conversationTitleInputSchema = z.object({
  /** 会话标题（1-255 字符） */
  title: z.string().trim().min(1).max(255),
});

export type ConversationTitleInput = z.infer<
  typeof conversationTitleInputSchema
>;

/**
 * 更新会话状态请求
 */
export const conversationStatusInputSchema = z.object({
  /** 目标状态 */
  status: conversationStatusSchema.refine(
    (status): boolean => status !== ConversationStatus.DELETED,
  ),
});

export type ConversationStatusInput = z.infer<
  typeof conversationStatusInputSchema
>;

/**
 * 会话列表查询参数
 */
const conversationQueryInputSchema = z.object({
  /** 会话状态过滤 */
  status: z.nativeEnum(ConversationQueryStatus).optional(),
  /** 标题关键词搜索 */
  keyword: z.string().optional(),
  /** 页码（从 0 开始） */
  current: z.number().int().min(0).optional(),
  /** 每页大小 */
  size: z.number().int().min(1).optional(),
  /** 分组筛选方式。 */
  groupFilter: z.enum(["ALL", "UNGROUPED", "GROUP"]).optional(),
  /** groupFilter=GROUP 时的分组 ID。 */
  groupId: z.number().int().positive().optional(),
});

/** 会话分组列表筛选。 */
export const conversationGroupFilterSchema = z.enum([
  "ALL",
  "UNGROUPED",
  "GROUP",
]);
export type ConversationGroupFilter = z.infer<
  typeof conversationGroupFilterSchema
>;

/** 明确分页的会话列表查询参数。 */
export const conversationPageInputSchema = conversationQueryInputSchema.extend({
  current: z.number().int().min(0).default(0),
  size: z.number().int().min(1).max(100).default(30),
  groupFilter: conversationGroupFilterSchema.default("ALL"),
  groupId: z.number().int().positive().optional(),
});
export type ConversationPageInput = z.input<typeof conversationPageInputSchema>;

/** 分组新建、改名参数。 */
export const conversationGroupNameInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
export type ConversationGroupNameInput = z.infer<
  typeof conversationGroupNameInputSchema
>;

/** 会话移动参数，显式 null 表示移回未分组。 */
export const updateConversationGroupInputSchema = z.object({
  groupId: z.number().int().positive().nullable(),
});

export type UseConversationOperationsReturn = {
  /** 获取会话分页。 */
  getConversationPage: (input?: ConversationPageInput) => Promise<ConversationPage>;
  /** 获取单条会话摘要，用于深链接恢复。 */
  getConversationSummary: (conversationId: string) => Promise<ConversationItem>;
  /** 一次性读取完整分组目录。 */
  getConversationGroups: () => Promise<ConversationGroupList>;
  /** 创建分组。 */
  createConversationGroup: (
    input: ConversationGroupNameInput,
  ) => Promise<ConversationGroup>;
  /** 重命名分组。 */
  renameConversationGroup: (
    groupId: number,
    input: ConversationGroupNameInput,
  ) => Promise<ConversationGroup>;
  /** 删除分组并将会话移回未分组。 */
  deleteConversationGroup: (groupId: number) => Promise<void>;
  /** 移动会话；null 表示移回未分组。 */
  moveConversation: (
    conversationId: string,
    groupId: number | null,
  ) => Promise<ConversationMetadata>;
  /** 更新会话标题 */
  updateTitle: (
    conversationId: string,
    input: ConversationTitleInput,
  ) => Promise<ConversationMetadata>;
  /** 获取会话标题及其生成状态。 */
  getConversationTitle: (
    conversationId: string,
    signal?: AbortSignal,
  ) => Promise<ConversationTitle>;
  /** 更新会话状态（归档/恢复） */
  updateStatus: (
    conversationId: string,
    input: ConversationStatusInput,
  ) => Promise<void>;
  /** 删除会话 */
  deleteConversation: (conversationId: string) => Promise<void>;
  /** 压缩会话上下文 */
  compactConversation: (conversationId: string) => Promise<void>;
  /** 获取当前会话的模型上下文使用量。 */
  getConversationContextUsage: (
    conversationId: string,
  ) => Promise<ConversationContextUsage>;
};

/**
 * 会话操作（更新标题、更新状态、删除）
 */
export function useConversationOperations({httpClient}: UseConversationOperationsOptions): UseConversationOperationsReturn {
  const providerSignal = useAiChatRequestSignal(httpClient);
  const getConversationPage = useCallback(
    (input?: ConversationPageInput): Promise<ConversationPage> => {
      const validated = conversationPageInputSchema.parse(input ?? {});
      return httpClient.conversations.listConversations({...validated, signal: providerSignal});
    },
    [httpClient, providerSignal],
  );

  const getConversationSummary = useCallback(
    (conversationId: string): Promise<ConversationItem> =>
      httpClient.conversations.getConversationSummary(conversationId, {signal: providerSignal}),
    [httpClient, providerSignal],
  );

  const getConversationGroups = useCallback(
    () =>
      httpClient.conversations.listConversationGroups({signal: providerSignal}),
    [httpClient, providerSignal],
  );

  const createConversationGroup = useCallback(
    (input: ConversationGroupNameInput) =>
      httpClient.conversations.createConversationGroup(conversationGroupNameInputSchema.parse(input), {signal: providerSignal}),
    [httpClient, providerSignal],
  );

  const renameConversationGroup = useCallback(
    (groupId: number, input: ConversationGroupNameInput) =>
      httpClient.conversations.renameConversationGroup(groupId, conversationGroupNameInputSchema.parse(input), {signal: providerSignal}),
    [httpClient, providerSignal],
  );

  const deleteConversationGroup = useCallback(
    async (groupId: number): Promise<void> => {
      await httpClient.conversations.deleteConversationGroup(groupId, {signal: providerSignal});
    },
    [httpClient, providerSignal],
  );

  const moveConversation = useCallback(
    (conversationId: string, groupId: number | null) =>
      httpClient.conversations.moveConversationToGroup(conversationId, updateConversationGroupInputSchema.parse({ groupId }), {signal: providerSignal}),
    [httpClient, providerSignal],
  );

  const updateTitle = useCallback(
    async (
      conversationId: string,
      input: ConversationTitleInput,
    ): Promise<ConversationMetadata> => {
      const validated = conversationTitleInputSchema.parse(input);
      return httpClient.conversations.updateConversationTitle(conversationId, validated, {signal: providerSignal});
    },
    [httpClient, providerSignal],
  );

  const getConversationTitle = useCallback(
    (
      conversationId: string,
      signal?: AbortSignal,
    ): Promise<ConversationTitle> =>
      httpClient.conversations.getConversationTitle(conversationId, {signal: signal ?? providerSignal}),
    [httpClient, providerSignal],
  );

  const updateStatus = useCallback(
    async (
      conversationId: string,
      input: ConversationStatusInput,
    ): Promise<void> => {
      const validated = conversationStatusInputSchema.parse(input);
      await httpClient.conversations.updateConversationStatus(conversationId, validated, {signal: providerSignal});
    },
    [httpClient, providerSignal],
  );

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      // 删除成功后不依赖响应体，兼容各使用方的 200/204 响应。
      await httpClient.conversations.deleteConversation(conversationId, {signal: providerSignal});
    },
    [httpClient, providerSignal],
  );

  const compactConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      // 后端压缩完成时不返回响应体。
      await httpClient.chat.compactConversation(conversationId, {signal: providerSignal});
    },
    [httpClient, providerSignal],
  );

  const getConversationContextUsage = useCallback(
    async (conversationId: string): Promise<ConversationContextUsage> => {
      const clientRequests =
        pendingContextUsageRequests.get(providerSignal??httpClient) ?? new Map();
      pendingContextUsageRequests.set(providerSignal??httpClient, clientRequests);
      const pendingRequest = clientRequests.get(conversationId);
      if (pendingRequest) return pendingRequest;

      const request = httpClient.conversations.getConversationContextUsage(conversationId, {signal: providerSignal});
      clientRequests.set(conversationId, request);
      try {
        return await request;
      } finally {
        if (clientRequests.get(conversationId) === request) {
          clientRequests.delete(conversationId);
        }
      }
    },
    [httpClient, providerSignal],
  );

  return {
    getConversationPage,
    getConversationSummary,
    getConversationGroups,
    createConversationGroup,
    renameConversationGroup,
    deleteConversationGroup,
    moveConversation,
    updateTitle,
    getConversationTitle,
    updateStatus,
    deleteConversation,
    compactConversation,
    getConversationContextUsage,
  };
}

/** 直接读取 SDK 会话分页，输入校验仅约束本地分页表单 */
export function requestConversationPage(httpClient: AgentsClient, input: ConversationPageInput, options: RequestOptions = {}): Promise<ConversationPage> {
 return httpClient.conversations.listConversations({...conversationPageInputSchema.parse(input), ...options});
}
