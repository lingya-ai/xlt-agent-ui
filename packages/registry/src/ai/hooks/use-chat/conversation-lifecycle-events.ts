import { z } from "zod";
import { ConversationStatus } from "./conversation-status";

export const CONVERSATION_LIFECYCLE_EVENT = "ai-conversation-lifecycle";
const STORAGE_KEY = "ai-conversation-lifecycle";
const statusChangeSchema = z.object({
  conversationId: z.string(),
  status: z.nativeEnum(ConversationStatus),
});
type ConversationStatusChange = z.infer<typeof statusChangeSchema>;

/** 同页广播确认结果；其他标签页只收到刷新信号并重新校验身份和状态。 */
function broadcast(event: Event) {
  window.dispatchEvent(event);
  try {
    localStorage.setItem(STORAGE_KEY, crypto.randomUUID());
  } catch {
    // 禁用本地存储时仍支持同页通知与窗口重新激活后的同步。
  }
}

/** 请求遭拒等情况下通知所有入口重新获取权威状态。 */
export function notifyConversationLifecycleChanged() {
  broadcast(new Event(CONVERSATION_LIFECYCLE_EVENT));
}

/** 状态接口成功后立即同步同页列表和数量，再由订阅方后台校准。 */
export function notifyConversationStatusChanged(
  conversationId: string,
  status: ConversationStatus,
) {
  broadcast(
    new CustomEvent(CONVERSATION_LIFECYCLE_EVENT, {
      detail: { conversationId, status },
    }),
  );
}

/** 监听跨组件、跨标签页及窗口重新激活后的状态变化。 */
export function subscribeConversationLifecycle(
  refresh: (change?: ConversationStatusChange) => void,
) {
  const onChange = (event: Event) => {
    const detail: unknown =
      event instanceof CustomEvent ? event.detail : undefined;
    const result = statusChangeSchema.safeParse(detail);
    refresh(result.success ? result.data : undefined);
  };
  const onFocus = () => refresh();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) refresh();
  };
  window.addEventListener(CONVERSATION_LIFECYCLE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", onFocus);
  return () => {
    window.removeEventListener(CONVERSATION_LIFECYCLE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", onFocus);
  };
}
