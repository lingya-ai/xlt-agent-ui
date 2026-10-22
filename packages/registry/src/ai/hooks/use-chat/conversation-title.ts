import { z } from "zod";

export const conversationTitleStateSchema = z.string().min(1);

export type ConversationTitleState =
  | "PENDING"
  | "GENERATING"
  | "AUTO"
  | "FALLBACK"
  | "MANUAL"
  | (string & {});


export type {ConversationTitle} from '@lingya-ai/agents-sdk/browser';

export const CONVERSATION_TITLE_POLLING_INTERVAL = 2_000;
export const CONVERSATION_TITLE_SYNC_TIMEOUT = 60_000;

const TERMINAL_TITLE_STATES = new Set<ConversationTitleState>([
  "AUTO",
  "FALLBACK",
  "MANUAL",
]);

const KNOWN_TITLE_STATES = new Set<ConversationTitleState>([
  "PENDING",
  "GENERATING",
  ...TERMINAL_TITLE_STATES,
]);

/** 判断标题是否仍可能由后端异步更新。 */
export function isPendingConversationTitleState(
  state: string | undefined,
): boolean {
  return state === "PENDING" || state === "GENERATING";
}

/** 判断标题是否已经进入后端定义的终态。 */
export function isTerminalConversationTitleState(
  state: string | undefined,
): boolean {
  return Boolean(state && TERMINAL_TITLE_STATES.has(state));
}

/** 判断标题状态是否属于当前前端已知契约。 */
export function isKnownConversationTitleState(state: string): boolean {
  return KNOWN_TITLE_STATES.has(state);
}

/** 生成轮询超时后的本地标题，避免列表长期停留在无意义的占位标题。 */
export function createLocalConversationTitle(
  firstUserMessage: string,
  unnamedTitle: string,
): string {
  return firstUserMessage.trim().slice(0, 30) || unnamedTitle;
}
