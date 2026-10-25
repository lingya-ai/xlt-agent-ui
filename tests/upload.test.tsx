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
const requestJson=async(input:RequestInfo|URL,init?:RequestInit):Promise<unknown>=>{
 if(input instanceof Request)return input.clone().json();
 if(init?.body)return JSON.parse(String(init.body));
 return undefined;
};
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
it("预签名上传申报实际文件大小，并按 POST_FORM 协议发送",async()=>{
 let openedMethod="",uploadBody:FormData|File|undefined;
 const headers:Record<string,string>={};
 class Upload {
  status=200;
  onabort?:()=>void; onloadend?:()=>void; onload?:()=>void; onerror?:()=>void;
  open(method:string){openedMethod=method;}
  setRequestHeader(name:string,value:string){headers[name]=value;}
  send(body:FormData|File){uploadBody=body;this.onload?.();this.onloadend?.();}
  abort(){this.onabort?.();this.onloadend?.();}
 }
 vi.stubGlobal("XMLHttpRequest",Upload);
 const presignBodies:unknown[]=[];
 const transport=vi.fn<typeof fetch>(async(input,init)=>{
  const url=requestUrl(input);
  if(url.includes("/files/meta/contentMd5"))return json({exists:false});
  if(url.includes("/files/pre-signed-url/write")){
   presignBodies.push(await requestJson(input,init));
   return json({support:true,fileUk:"file-uk",url:"https://storage.invalid/upload",uploadMethod:"POST_FORM",formFields:{policy:"policy-value"},maximumBytes:4});
  }
  if(url.includes("/files/pre-signed-url/confirm"))return json({id:11,fileName:"test.txt"});
  throw new Error(`unexpected request ${url}`);
 });
 const client=createClient(transport);
 const hook=renderHook(()=>useUploadChatAttachment(client));
 const file=new File(["test"],"test.txt");
 expect(await hook.result.current(file)).toBe(11);
 expect(presignBodies).toHaveLength(1);
 expect(presignBodies[0]).toMatchObject({fileName:"test.txt",module:"ai-chat-attachments",contentMd5:"content-hash",sizeBytes:4});
 expect(openedMethod).toBe("POST");
 expect(headers["Content-MD5"]).toBeUndefined();
 expect(uploadBody).toBeInstanceOf(FormData);
 const form=uploadBody as FormData;
 expect(form.get("policy")).toBe("policy-value");
 expect(form.get("file")).toBeInstanceOf(File);
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
