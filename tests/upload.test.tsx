import {renderHook,waitFor} from "@testing-library/react";
import type {ReactNode} from "react";
import {afterEach,expect,it,vi} from "vitest";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {AgentProvider} from "../packages/registry/src/openapi/provider";
import {useUploadChatAttachment} from "../packages/registry/src/ai/hooks/use-chat/use-upload-chat-attachment";
import {buildChatClientCacheKey,clearChatClientCache} from "../packages/registry/src/ai/lib/chat-client-cache-key";
import {getCache,setCache} from "../packages/registry/src/api/hooks/use-request/utils/cache";
vi.mock("../packages/registry/src/ai/lib/file-md5",()=>({fileMd5:async()=>"content-hash"}));
const createClient=(network:typeof fetch=fetch)=>new AgentsClient({baseUrl:"https://test.invalid",channelId:"channel",fetch:network,auth:{type:"token",tokenProvider:()=>"once-token"}});
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}});
const requestUrl=(input:RequestInfo|URL)=>input instanceof Request?input.url:String(input);
afterEach(()=>vi.unstubAllGlobals());
it("附件去重命中只创建记录，避免重复上传",async()=>{
 const transport=vi.fn<typeof fetch>(async input=>json(new URL(requestUrl(input)).searchParams.has("contentMd5")?{exists:true}:{id:7,fileName:"test.txt",contentMd5:"content-hash",size:4,createdTime:"2026-10-21T00:00:00Z",lastUpdateTime:"2026-10-21T00:00:00Z"}));
 const client=createClient(transport);
 const hook=renderHook(()=>useUploadChatAttachment(client));
 expect(await hook.result.current(new File(["test"],"test.txt"))).toBe(7);
 expect(transport).toHaveBeenCalledTimes(2);
 expect(transport.mock.calls.some(([input])=>requestUrl(input).includes("pre-signed"))).toBe(false);
});
it("Provider 卸载中断文件直传，不提交上传确认",async()=>{
 let sent=false,aborted=false;
 class Upload {
  onabort?:()=>void; onloadend?:()=>void; onload?:()=>void; onerror?:()=>void;
  open(){} setRequestHeader(){} send(){sent=true;}
  abort(){aborted=true;this.onabort?.();this.onloadend?.();}
 }
 vi.stubGlobal("XMLHttpRequest",Upload);
 const transport=vi.fn<typeof fetch>(async input=>json(new URL(requestUrl(input)).searchParams.has("contentMd5")?{exists:false}:{support:true,fileUk:"file-uk",url:"https://storage.invalid/upload"}));
 const client=createClient(transport);
 const wrapper=({children}:{children:ReactNode})=><AgentProvider client={client} identityKey="upload">{children}</AgentProvider>;
 const hook=renderHook(()=>useUploadChatAttachment(client),{wrapper});
 const promise=hook.result.current(new File(["test"],"test.txt"));
 const rejection=expect(promise).rejects.toThrow("上传已取消");
 await waitFor(()=>expect(sent).toBe(true));
 hook.unmount();await rejection;
 expect(aborted).toBe(true);
 expect(transport.mock.calls.some(([input])=>requestUrl(input).endsWith("/confirm"))).toBe(false);
});
it("独立使用的 UI 缓存可按 SDK 实例清理，不影响其他身份",()=>{
 const a=createClient(),b=createClient();
 const keyA=buildChatClientCacheKey(a,"file-preview","conversation",1);
 const keyB=buildChatClientCacheKey(b,"file-preview","conversation",1);
 setCache(keyA,-1,{data:"a",params:[],time:Date.now()});
 setCache(keyB,-1,{data:"b",params:[],time:Date.now()});
 clearChatClientCache(a);
 expect(getCache(keyA)).toBeUndefined();expect(getCache(keyB)?.data).toBe("b");
 clearChatClientCache(b);
});
