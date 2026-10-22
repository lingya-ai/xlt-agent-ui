import {clearCache} from "../../api/hooks/use-request/utils/cache";
import type {AgentsClient} from "@lingya-ai/agents-sdk/browser";
const scopes=new WeakMap<object,{id:number;keys:Set<string>}>();
let nextScope=0;
/** 缓存仅归属 UI 生命周期；SDK 实例保持原样。 */
export function buildScopedChatClientCacheKey(client:AgentsClient,scope:object,namespace:string,...parts:readonly(string|number|null)[]):string {
 let entry=scopes.get(scope);
 if(!entry){entry={id:++nextScope,keys:new Set()};scopes.set(scope,entry);}
 const key=JSON.stringify([namespace,entry.id,client.channelId,...parts]);entry.keys.add(key);return key;
}
/** 无 Provider 时按客户端实例隔离。 */
export function buildChatClientCacheKey(client:AgentsClient,namespace:string,...parts:readonly(string|number|null)[]):string {
 return buildScopedChatClientCacheKey(client,client,namespace,...parts);
}
/** 清理指定 UI 生命周期的缓存，不影响同一 SDK 客户端的其他 Provider。 */
export function clearChatClientCache(scope:object) {
 const entry=scopes.get(scope);if(entry){clearCache([...entry.keys]);entry.keys.clear();}
}
