import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useAiChatRequestSignal} from "../../agents/context";
import {buildScopedChatClientCacheKey} from "../../lib/chat-client-cache-key";
/** Provider 每次身份切换均分配新缓存范围，同一个 SDK 实例也不会复用旧身份数据。 */
export function useChatClientCacheKey(client:AgentsClient,namespace:string,...parts:readonly(string|number|null)[]):string {
 const signal=useAiChatRequestSignal(client);
 return buildScopedChatClientCacheKey(client,signal??client,namespace,...parts);
}
