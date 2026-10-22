import type {ChatStreamHealthReason, ChatStreamHealthState, ChatStreamHealthStatus} from "./chat-stream-health";
import type {ChatItem, ChatStreamRecoveryState} from "./types";

type ChatStreamVisibleStatusBase = {
  healthStatus: ChatStreamHealthStatus;
  reason?: ChatStreamHealthReason;
  isProbing: boolean;
  detectedAt?: number;
};

export type ChatStreamAggregateStatus =
  | {kind: "hidden"}
  | (ChatStreamVisibleStatusBase & {kind: "offline"})
  | (ChatStreamVisibleStatusBase & {kind: "reconnecting"})
  | (ChatStreamVisibleStatusBase & {kind: "rebuilding"})
  | (ChatStreamVisibleStatusBase & {kind: "checking"})
  | (ChatStreamVisibleStatusBase & {
      kind: "degraded";
      healthStatus: "suspected" | "buffered" | "unavailable" | "inconclusive";
    });

/** 从消息列表尾部查找最近一次仍在进行的断线恢复状态。 */
export function findLatestChatStreamRecoveryState(
  chatList: readonly ChatItem[],
): ChatStreamRecoveryState | undefined {
  for (let index = chatList.length - 1; index >= 0; index -= 1) {
    const recoveryState = chatList[index]?.streamRecoveryState;
    if (recoveryState) return recoveryState;
  }
  return undefined;
}

/**
 * 聚合设备联网状态、对话流恢复状态和 SSE 健康检查结果。
 *
 * 优先级确保同一时间只展示一个用户提示：离线 > 恢复流程 > 已确认异常 > 主动检测。
 */
export function resolveChatStreamStatus(input: {
  recoveryState?: ChatStreamRecoveryState;
  health: ChatStreamHealthState;
  isOnline: boolean;
}): ChatStreamAggregateStatus {
  const {recoveryState, health, isOnline} = input;
  const visibleState = {
    healthStatus: health.status,
    reason: health.reason,
    isProbing: health.isProbing,
    detectedAt: health.detectedAt,
  };

  if (!isOnline) return {kind: "offline", ...visibleState};
  if (recoveryState === "rebuilding") return {kind: "rebuilding", ...visibleState};
  if (recoveryState === "reconnecting") return {kind: "reconnecting", ...visibleState};

  if (
    health.status === "suspected" ||
    health.status === "buffered" ||
    health.status === "unavailable" ||
    health.status === "inconclusive"
  ) {
    return {kind: "degraded", ...visibleState, healthStatus: health.status};
  }

  if (health.isProbing) return {kind: "checking", ...visibleState};
  return {kind: "hidden"};
}
