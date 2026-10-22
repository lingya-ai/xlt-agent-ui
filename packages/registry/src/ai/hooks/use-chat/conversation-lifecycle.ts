import {
  ConversationQueryStatus,
  ConversationStatus,
} from "./use-conversation-operations";

export {
  notifyConversationLifecycleChanged,
  notifyConversationStatusChanged,
  subscribeConversationLifecycle,
} from "./conversation-lifecycle-events";

/** 判断会话是否仍属于当前视图。 */
export function matchesConversationView(
  view: ConversationQueryStatus,
  status: ConversationStatus,
) {
  return (
    status !== ConversationStatus.DELETED &&
    (view === ConversationQueryStatus.ALL ||
      (view === ConversationQueryStatus.ACTIVE &&
        status === ConversationStatus.ACTIVE) ||
      (view === ConversationQueryStatus.ARCHIVED &&
        status === ConversationStatus.ARCHIVED))
  );
}
