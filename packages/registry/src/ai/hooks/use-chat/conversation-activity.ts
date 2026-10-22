import {z} from 'zod';
import type {AgentsClient, RequestOptions, ConversationActivity, ConversationReadReceipt as ConversationReadReceiptActivity, ConversationActivityList, ConversationIds} from '@lingya-ai/agents-sdk/browser';
export type {ConversationActivity, ConversationReadReceipt as ConversationReadReceiptActivity, ConversationActivityList} from '@lingya-ai/agents-sdk/browser';
export type ActiveConversations = ConversationIds;
export type UnreadConversations = ConversationIds;
export type ConversationActivityStatus = ConversationActivity['executionStatus'];
const CONVERSATION_ACTIVITY_BATCH_SIZE = 1000;
const nonEmptyIdSchema = z.string().trim().min(1);
export const conversationActivityBatchInputSchema = z.object({conversationIds:z.array(nonEmptyIdSchema).min(1).max(CONVERSATION_ACTIVITY_BATCH_SIZE)});
export const conversationReadInputSchema = z.object({messageId:nonEmptyIdSchema});
export interface ConversationReadEligibilityInput {
  activity: ConversationActivity | undefined;
  activeConversationId: string | null;
  enabled: boolean;
  snapshotReady: boolean;
  readableMessageIds?: readonly string[];
  pageVisible: boolean;
  windowFocused: boolean;
}

/** 本地尚未被服务端快照接管的执行覆盖。 */
export interface ConversationExecutionOverride {
  conversationId: string;
  messageId: string;
}

/** 会话活动 Hook 的可测试状态。 */
export interface ConversationActivityState {
  serverByConversationId: ReadonlyMap<string, ConversationActivity>;
  executionOverrideByConversationId: ReadonlyMap<
    string,
    ConversationExecutionOverride
  >;
  pendingCompletionByConversationId: ReadonlyMap<
    string,
    { messageId: string; epoch: string | null }
  >;
  lastStartedMessageByConversationId: ReadonlyMap<string, string>;
  optimisticReadByConversationId: ReadonlyMap<string, string>;
  lastOperationByConversationId: ReadonlyMap<string, number>;
}

export type ConversationActivityAction =
  | {
      type: "snapshot-succeeded";
      requestedConversationIds: readonly string[];
      activities: readonly ConversationActivity[];
      operationId: number;
    }
  | {
      type: "conversation-started";
      conversationId: string;
      messageId: string;
      operationId: number;
    }
  | {
      type: "conversation-completed";
      conversationId: string;
      messageId: string;
      operationId: number;
    }
  | {
      type: "read-started";
      conversationId: string;
      messageId: string;
    }
  | {
      type: "read-succeeded";
      activity: ConversationReadReceiptActivity;
      operationId: number;
    }
  | {
      type: "read-failed";
      conversationId: string;
      messageId: string;
    }
  | {
      type: "retain-conversations";
      conversationIds: readonly string[];
    }
  | { type: "remove-conversation"; conversationId: string };

/** 创建空的会话活动状态。 */
export function createConversationActivityState(): ConversationActivityState {
  return {
    serverByConversationId: new Map(),
    executionOverrideByConversationId: new Map(),
    pendingCompletionByConversationId: new Map(),
    lastStartedMessageByConversationId: new Map(),
    optimisticReadByConversationId: new Map(),
    lastOperationByConversationId: new Map(),
  };
}

/** 去重并稳定排序会话 ID，避免列表重渲染触发无意义请求。 */
export function normalizeConversationIds(
  conversationIds: readonly string[],
): string[] {
  return Array.from(
    new Set(conversationIds.map((id) => id.trim()).filter(Boolean)),
  ).sort();
}

/** 按后端限制把会话 ID 拆成稳定批次。 */
export function chunkConversationIds(
  conversationIds: readonly string[],
): string[][] {
  const normalized = normalizeConversationIds(conversationIds);
  const chunks: string[][] = [];
  for (
    let index = 0;
    index < normalized.length;
    index += CONVERSATION_ACTIVITY_BATCH_SIZE
  ) {
    chunks.push(
      normalized.slice(index, index + CONVERSATION_ACTIVITY_BATCH_SIZE),
    );
  }
  return chunks;
}

/** 批量读取会话活动；超过 1000 个 ID 时拆分请求并合并结果。 */
export async function requestConversationActivities(
  httpClient: AgentsClient,
  conversationIds: readonly string[],
  options: RequestOptions={},
): Promise<ConversationActivityList> {
  const chunks = chunkConversationIds(conversationIds);
  if (chunks.length === 0) return { records: [] };

  const responses = await Promise.all(
    chunks.map((ids) => {
      const input = conversationActivityBatchInputSchema.parse({
        conversationIds: ids,
      });
      return httpClient.conversations.queryConversationActivities(input, options);
    }),
  );

  return {
    records: responses.flatMap((response) => response.records),
  };
}

/** 读取当前身份下正在执行、排队或仍有异步任务的全部根会话 ID。 */
export async function requestActiveConversations(
  httpClient: AgentsClient,
  options: RequestOptions={},
): Promise<ActiveConversations> {
  const response = await httpClient.conversations.listActiveConversations(options);
  return {
    conversationIds: normalizeConversationIds(response.conversationIds),
  };
}

/** 读取当前身份下存在未读终态消息的全部根会话 ID。 */
export async function requestUnreadConversations(
  httpClient: AgentsClient,
  options: RequestOptions={},
): Promise<UnreadConversations> {
  const response = await httpClient.conversations.listUnreadConversations(options);
  return {
    conversationIds: normalizeConversationIds(response.conversationIds),
  };
}

/** 把当前客户端已经展示的终态消息精确标记为已读。 */
export function markConversationRead(
  httpClient: AgentsClient,
  conversationId: string,
  messageId: string,
  options: RequestOptions={},
): Promise<ConversationReadReceiptActivity> {
  const validatedConversationId = nonEmptyIdSchema.parse(conversationId);
  const input = conversationReadInputSchema.parse({ messageId });
  return httpClient.conversations.markConversationRead(validatedConversationId, input, options);
}

/** 比较两个可能超出 JavaScript 安全整数范围的十进制 epoch。 */
export function compareExecutionEpoch(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length > normalizedRight.length ? 1 : -1;
  }
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft > normalizedRight ? 1 : -1;
}

/** 只有用户聚焦于当前聊天会话时，才允许自动确认最新终态消息已读。 */
export function shouldAutomaticallyMarkConversationRead({
  activity,
  activeConversationId,
  enabled,
  snapshotReady,
  readableMessageIds,
  pageVisible,
  windowFocused,
}: ConversationReadEligibilityInput): boolean {
  return Boolean(
    enabled &&
      snapshotReady &&
      pageVisible &&
      windowFocused &&
      activity?.executionStatus === "IDLE" &&
      activity.hasUnreadCompletion &&
      Boolean(activity.latestTerminalMessageId) &&
      Boolean(
        readableMessageIds?.includes(activity.latestTerminalMessageId ?? ""),
      ) &&
      activity.conversationId === activeConversationId,
  );
}

function shouldKeepCurrentEpoch(
  current: ConversationActivity | undefined,
  incoming: ConversationActivity,
): boolean {
  return Boolean(
    current?.executionEpoch &&
      incoming.executionEpoch &&
      compareExecutionEpoch(current.executionEpoch, incoming.executionEpoch) >
        0,
  );
}

function shouldReleaseExecutionOverride(
  override: ConversationExecutionOverride,
  activity: ConversationActivity,
  previousActivity: ConversationActivity | undefined,
): boolean {
  if (activity.executionStatus === "IDLE") {
    return true;
  }
  if (activity.activeMessageId === override.messageId) {
    return true;
  }
  if (
    activity.executionEpoch &&
    previousActivity?.executionEpoch &&
    compareExecutionEpoch(
      activity.executionEpoch,
      previousActivity.executionEpoch,
    ) > 0
  ) {
    return true;
  }
  return Boolean(
    activity.activeMessageId && activity.activeMessageId !== override.messageId,
  );
}

function retainMapEntries<T>(
  source: ReadonlyMap<string, T>,
  retainedIds: ReadonlySet<string>,
): Map<string, T> {
  return new Map(
    Array.from(source).filter(([conversationId]) =>
      retainedIds.has(conversationId),
    ),
  );
}

/** 归并服务端快照、本地执行覆盖和乐观已读状态。 */
export function conversationActivityReducer(
  state: ConversationActivityState,
  action: ConversationActivityAction,
): ConversationActivityState {
  switch (action.type) {
    case "snapshot-succeeded": {
      const lastStartedMessageByConversationId = new Map(
        state.lastStartedMessageByConversationId,
      );
      const pendingCompletionByConversationId = new Map(
        state.pendingCompletionByConversationId,
      );
      const serverByConversationId = new Map(state.serverByConversationId);
      const executionOverrideByConversationId = new Map(
        state.executionOverrideByConversationId,
      );
      const optimisticReadByConversationId = new Map(
        state.optimisticReadByConversationId,
      );
      const lastOperationByConversationId = new Map(
        state.lastOperationByConversationId,
      );
      const activityById = new Map(
        action.activities.map((activity) => [
          activity.conversationId,
          activity,
        ]),
      );

      action.requestedConversationIds.forEach((conversationId) => {
        const previousOperationId =
          lastOperationByConversationId.get(conversationId) ?? 0;
        if (action.operationId < previousOperationId) return;

        const incoming = activityById.get(conversationId);
        if (!incoming) {
          lastOperationByConversationId.set(conversationId, action.operationId);
          serverByConversationId.delete(conversationId);
          executionOverrideByConversationId.delete(conversationId);
          optimisticReadByConversationId.delete(conversationId);
          return;
        }

        const current = serverByConversationId.get(conversationId);
        if (shouldKeepCurrentEpoch(current, incoming)) return;
        lastOperationByConversationId.set(conversationId, action.operationId);
        serverByConversationId.set(conversationId, incoming);
        const pending = pendingCompletionByConversationId.get(conversationId);
        if (
          pending &&
          (incoming.latestTerminalMessageId === pending.messageId ||
            (pending.epoch &&
              incoming.executionEpoch &&
              compareExecutionEpoch(incoming.executionEpoch, pending.epoch) >
                0))
        ) {
          pendingCompletionByConversationId.delete(conversationId);
        }

        const override = executionOverrideByConversationId.get(conversationId);
        if (
          override &&
          shouldReleaseExecutionOverride(override, incoming, current)
        ) {
          executionOverrideByConversationId.delete(conversationId);
        }

        const optimisticMessageId =
          optimisticReadByConversationId.get(conversationId);
        if (
          optimisticMessageId === incoming.latestTerminalMessageId &&
          !incoming.hasUnreadCompletion
        ) {
          optimisticReadByConversationId.delete(conversationId);
        }
      });

      return {
        serverByConversationId,
        pendingCompletionByConversationId,
        lastStartedMessageByConversationId,
        executionOverrideByConversationId,
        optimisticReadByConversationId,
        lastOperationByConversationId,
      };
    }

    case "conversation-started": {
      const lastStartedMessageByConversationId = new Map(
        state.lastStartedMessageByConversationId,
      );
      lastStartedMessageByConversationId.set(
        action.conversationId,
        action.messageId,
      );
      const pendingCompletionByConversationId = new Map(
        state.pendingCompletionByConversationId,
      );
      pendingCompletionByConversationId.delete(action.conversationId);
      const executionOverrideByConversationId = new Map(
        state.executionOverrideByConversationId,
      );
      const lastOperationByConversationId = new Map(
        state.lastOperationByConversationId,
      );
      executionOverrideByConversationId.set(action.conversationId, {
        conversationId: action.conversationId,
        messageId: action.messageId,
      });
      lastOperationByConversationId.set(
        action.conversationId,
        action.operationId,
      );
      return {
        ...state,
        lastStartedMessageByConversationId,
        pendingCompletionByConversationId,
        executionOverrideByConversationId,
        lastOperationByConversationId,
      };
    }

    case "conversation-completed": {
      const lastStarted = state.lastStartedMessageByConversationId.get(
        action.conversationId,
      );
      if (lastStarted && lastStarted !== action.messageId) return state;
      const server = state.serverByConversationId.get(action.conversationId);
      if (
        server?.latestTerminalMessageId === action.messageId &&
        !state.executionOverrideByConversationId.has(action.conversationId)
      )
        return state;
      const current = state.executionOverrideByConversationId.get(
        action.conversationId,
      );
      if (current && current.messageId !== action.messageId) return state;
      const pendingCompletionByConversationId = new Map(
        state.pendingCompletionByConversationId,
      );
      pendingCompletionByConversationId.set(action.conversationId, {
        messageId: action.messageId,
        epoch:
          state.serverByConversationId.get(action.conversationId)
            ?.executionEpoch ?? null,
      });
      const executionOverrideByConversationId = new Map(
        state.executionOverrideByConversationId,
      );
      const lastOperationByConversationId = new Map(
        state.lastOperationByConversationId,
      );
      executionOverrideByConversationId.delete(action.conversationId);
      lastOperationByConversationId.set(
        action.conversationId,
        action.operationId,
      );
      return {
        ...state,
        pendingCompletionByConversationId,
        executionOverrideByConversationId,
        lastOperationByConversationId,
      };
    }

    case "read-started": {
      const optimisticReadByConversationId = new Map(
        state.optimisticReadByConversationId,
      );
      optimisticReadByConversationId.set(
        action.conversationId,
        action.messageId,
      );
      return { ...state, optimisticReadByConversationId };
    }

    case "read-succeeded": {
      const conversationId = action.activity.conversationId;
      const previousOperationId =
        state.lastOperationByConversationId.get(conversationId) ?? 0;
      if (action.operationId < previousOperationId) return state;

      const current = state.serverByConversationId.get(conversationId);
      const serverByConversationId = new Map(state.serverByConversationId);
      const activity: ConversationActivity = {
        ...action.activity,
        requiresUserConfirmation:
          current?.executionEpoch === action.activity.executionEpoch &&
          current?.activeMessageId === action.activity.activeMessageId
            ? current?.requiresUserConfirmation ?? false
            : false,
      };
      if (!shouldKeepCurrentEpoch(current, activity)) {
        serverByConversationId.set(conversationId, activity);
      }
      const lastOperationByConversationId = new Map(
        state.lastOperationByConversationId,
      );
      lastOperationByConversationId.set(conversationId, action.operationId);
      return {
        ...state,
        serverByConversationId,
        lastOperationByConversationId,
      };
    }

    case "read-failed": {
      if (
        state.optimisticReadByConversationId.get(action.conversationId) !==
        action.messageId
      ) {
        return state;
      }
      const optimisticReadByConversationId = new Map(
        state.optimisticReadByConversationId,
      );
      optimisticReadByConversationId.delete(action.conversationId);
      return {
        ...state,
        optimisticReadByConversationId,
      };
    }

    case "retain-conversations": {
      const retainedIds = new Set(action.conversationIds);
      return {
        serverByConversationId: retainMapEntries(
          state.serverByConversationId,
          retainedIds,
        ),
        executionOverrideByConversationId: retainMapEntries(
          state.executionOverrideByConversationId,
          retainedIds,
        ),
        lastStartedMessageByConversationId: retainMapEntries(
          state.lastStartedMessageByConversationId,
          retainedIds,
        ),
        pendingCompletionByConversationId: retainMapEntries(
          state.pendingCompletionByConversationId,
          retainedIds,
        ),
        optimisticReadByConversationId: retainMapEntries(
          state.optimisticReadByConversationId,
          retainedIds,
        ),
        lastOperationByConversationId: retainMapEntries(
          state.lastOperationByConversationId,
          retainedIds,
        ),
      };
    }

    case "remove-conversation": {
      const lastStartedMessageByConversationId = new Map(
        state.lastStartedMessageByConversationId,
      );
      const pendingCompletionByConversationId = new Map(
        state.pendingCompletionByConversationId,
      );
      const serverByConversationId = new Map(state.serverByConversationId);
      const executionOverrideByConversationId = new Map(
        state.executionOverrideByConversationId,
      );
      const optimisticReadByConversationId = new Map(
        state.optimisticReadByConversationId,
      );
      const lastOperationByConversationId = new Map(
        state.lastOperationByConversationId,
      );
      lastStartedMessageByConversationId.delete(action.conversationId);
      pendingCompletionByConversationId.delete(action.conversationId);
      serverByConversationId.delete(action.conversationId);
      executionOverrideByConversationId.delete(action.conversationId);
      optimisticReadByConversationId.delete(action.conversationId);
      lastOperationByConversationId.delete(action.conversationId);
      return {
        serverByConversationId,
        pendingCompletionByConversationId,
        lastStartedMessageByConversationId,
        executionOverrideByConversationId,
        optimisticReadByConversationId,
        lastOperationByConversationId,
      };
    }
  }
}

/**
 * 选择下一轮需要查询的会话。
 *
 * 活跃会话由 `/conversations/active` 发现；这里仅保留服务端处于排队/执行中，
 * 或本地刚发起、刚完成且仍待服务端确认的会话。
 */
export function selectConversationActivityPollingIds(
  state: ConversationActivityState,
  conversationIds: readonly string[],
): string[] {
  return normalizeConversationIds(conversationIds).filter((conversationId) => {
    if (state.pendingCompletionByConversationId.has(conversationId))
      return true;
    if (state.executionOverrideByConversationId.has(conversationId))
      return true;

    const status =
      state.serverByConversationId.get(conversationId)?.executionStatus;
    return status === "QUEUED" || status === "RUNNING";
  });
}

/** 生成供界面使用的活动 Map，并应用运行态和已读态展示优先级。 */
export function selectConversationActivities(
  state: ConversationActivityState,
): ReadonlyMap<string, ConversationActivity> {
  const result = new Map(state.serverByConversationId);

  state.executionOverrideByConversationId.forEach((override) => {
    const current = result.get(override.conversationId);
    result.set(override.conversationId, {
      conversationId: override.conversationId,
      executionStatus: "RUNNING",
      activeMessageId: override.messageId,
      executionEpoch: current?.executionEpoch ?? null,
      executionStartedTime: current?.executionStartedTime ?? null,
      latestTerminalMessageId: current?.latestTerminalMessageId ?? null,
      latestTerminalTime: current?.latestTerminalTime ?? null,
      hasUnreadCompletion: current?.hasUnreadCompletion ?? false,
      requiresUserConfirmation: false,
    });
  });

  state.optimisticReadByConversationId.forEach((messageId, conversationId) => {
    const current = result.get(conversationId);
    if (
      current?.latestTerminalMessageId === messageId &&
      current.hasUnreadCompletion
    ) {
      result.set(conversationId, {
        ...current,
        hasUnreadCompletion: false,
      });
    }
  });

  return result;
}
