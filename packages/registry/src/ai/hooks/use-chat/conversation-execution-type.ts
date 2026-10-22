/** 从消息内容优先读取执行类型，兼容仅有外层类型的旧记录和本地用户消息。 */
export function resolveConversationExecutionType(
  userMessage: {executionType?: string} | undefined,
  executionType?: string,
): string {
  return userMessage?.executionType ?? executionType ?? "USER_MESSAGE";
}
