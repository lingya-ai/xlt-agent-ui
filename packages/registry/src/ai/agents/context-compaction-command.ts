export type ContextCompactionCommandStatus =
  | "NO_CONTEXT"
  | "RESPONDING"
  | "LOADING"
  | "READY";

interface ContextCompactionCommandOptions {
  conversationId?: string;
  isResponding: boolean;
  usagePending: boolean;
  canCompact: boolean;
}

/** 计算上下文压缩命令的可操作状态，并确保不可用状态不能被键盘或鼠标触发。 */
export function getContextCompactionCommandState({
  conversationId,
  isResponding,
  usagePending,
  canCompact,
}: ContextCompactionCommandOptions): {
  disabled: boolean;
  status: ContextCompactionCommandStatus;
} {
  if (!conversationId) return { disabled: true, status: "NO_CONTEXT" };
  if (isResponding) return { disabled: true, status: "RESPONDING" };
  if (usagePending) return { disabled: true, status: "LOADING" };
  return { disabled: !canCompact, status: "READY" };
}

/** 常驻用量仅在调用方开启显示且存在可读会话时自动加载。 */
export function shouldAutomaticallyLoadContextUsage({
  conversationId,
  readOnly,
  showContextWindowUsage,
}: {
  conversationId?: string;
  readOnly: boolean;
  showContextWindowUsage: boolean;
}): boolean {
  return !readOnly && showContextWindowUsage && Boolean(conversationId);
}
