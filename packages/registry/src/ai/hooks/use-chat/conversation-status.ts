/**
 * 会话状态枚举（与后端 ConversationStatusEnum 对齐）
 */
export enum ConversationStatus {
  /** 活跃 */
  ACTIVE = "ACTIVE",
  /** 已归档 */
  ARCHIVED = "ARCHIVED",
  /** 已删除 */
  DELETED = "DELETED",
}

/** 列表筛选，ALL 不属于存储状态。 */
export enum ConversationQueryStatus {
  ACTIVE = "ACTIVE",
  ALL = "ALL",
  ARCHIVED = "ARCHIVED",
}
