/** 与虚拟列表的末端跟随阈值保持一致。 */
export const STICK_TO_BOTTOM_THRESHOLD = 70;

export type MessageScrollRestoreTarget =
  | { kind: "bottom" }
  | { kind: "message"; messageId: string; offsetTop: number };

function getMessageScrollElements(root: HTMLElement | null) {
  const scrollContent = root?.querySelector<HTMLElement>("[data-chat-scroll]");
  const messageList = scrollContent?.querySelector<HTMLElement>(
    "[data-chat-message-list]",
  );
  const scrollContainer = scrollContent?.parentElement;
  if (!scrollContainer || !messageList) return undefined;
  return { scrollContainer, messageList };
}

/** 捕获首个可见消息或末端锚点；仅扫描挂载的行，兼容虚拟列表的绝对定位。 */
export function captureMessageScrollPosition(
  root: HTMLElement | null,
): MessageScrollRestoreTarget | undefined {
  const elements = getMessageScrollElements(root);
  if (!elements) return undefined;
  const { scrollContainer, messageList } = elements;
  const distanceFromBottom =
    scrollContainer.scrollHeight -
    scrollContainer.scrollTop -
    scrollContainer.clientHeight;
  if (distanceFromBottom <= STICK_TO_BOTTOM_THRESHOLD)
    return { kind: "bottom" };

  const viewport = scrollContainer.getBoundingClientRect();
  const anchor = Array.from(messageList.children).find((element) => {
    if (!(element instanceof HTMLElement) || !element.dataset.messageId)
      return false;
    const rect = element.getBoundingClientRect();
    return rect.bottom > viewport.top && rect.top < viewport.bottom;
  });
  if (!(anchor instanceof HTMLElement) || !anchor.dataset.messageId)
    return undefined;
  return {
    kind: "message",
    messageId: anchor.dataset.messageId,
    offsetTop: anchor.getBoundingClientRect().top - viewport.top,
  };
}

/** 恢复相对视口偏移；消息已被卸载时不猜测位置，交由虚拟列表维持窗口。 */
export function restoreMessageScrollPosition(
  root: HTMLElement | null,
  target: MessageScrollRestoreTarget,
): void {
  const elements = getMessageScrollElements(root);
  if (!elements) return;
  const { scrollContainer, messageList } = elements;
  if (target.kind === "bottom") {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    return;
  }
  const anchor = Array.from(messageList.children).find(
    (element) =>
      element instanceof HTMLElement &&
      element.dataset.messageId === target.messageId,
  );
  if (!(anchor instanceof HTMLElement)) return;
  const containerTop = scrollContainer.getBoundingClientRect().top;
  scrollContainer.scrollTop +=
    anchor.getBoundingClientRect().top - containerTop - target.offsetTop;
}
