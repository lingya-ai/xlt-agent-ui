import {act, render, renderHook, waitFor} from '@testing-library/react';
import {StrictMode, useEffect, type ReactNode} from 'react';
import {AgentProvider} from '../packages/registry/src/openapi/provider';
import {useAiChatContext} from '../packages/registry/src/ai/agents/context';
import {useWorkspaceFiles} from '../packages/registry/src/ai/hooks/use-chat/use-workspace-files';
import {useWorkspaceFilePreviewUrlCallback} from '../packages/registry/src/ai/hooks/use-chat/use-workspace-file-preview-url';
import {useChatClientCacheKey} from '../packages/registry/src/ai/hooks/use-chat/use-chat-client-cache-key';
import {getCache,setCache} from '../packages/registry/src/api/hooks/use-request/utils/cache';
import {describe, expect, it, vi} from 'vitest';
import {AgentsClient, ApiError} from '@lingya-ai/agents-sdk/browser';
import {AiChatContextProvider} from '../packages/registry/src/ai/agents/context';
import {useSubmitPlanApproval, useSubmitUserInputAnswer} from '../packages/registry/src/ai/hooks/use-chat/use-hitl';
import {useConversationOperations} from '../packages/registry/src/ai/hooks/use-chat/use-conversation-operations';

function clientWith(network:typeof fetch, tokenProvider=vi.fn(()=>'fresh-token')) {
 return new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',fetch:network,auth:{type:'token',tokenProvider}});
}
function json(value:unknown,status=200) {return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});}
describe('UI 直接调用 SDK',()=>{
 it('审批写请求使用 SDK 认证且 HTTP 失败不重放',async()=>{
  const network=vi.fn<typeof fetch>(async()=>json({code:'DENIED',message:'审批失败',fields:[],requestId:'server-request'},409));
  const token=vi.fn(()=>'single-use');
  const client=clientWith(network,token);
  const {result}=renderHook(()=>useSubmitPlanApproval(client));
  let failure:unknown;
  await act(async()=>{try{await result.current({conversationId:'c',messageId:'m',approved:true});}catch(error){failure=error;}});
  expect(failure).toBeInstanceOf(ApiError);
  expect(failure).toMatchObject({kind:'http',status:409,code:'DENIED',message:'审批失败'});
  expect(network).toHaveBeenCalledTimes(1);
  expect(token).toHaveBeenCalledTimes(1);
  const input=network.mock.calls[0]?.[0];
  expect(input).toBeInstanceOf(Request);
  if(!(input instanceof Request))throw new Error('SDK 应使用 Request');
  expect(input.headers.get('X-OpenAPI-Token')).toBe('single-use');
  expect(await input.json()).toMatchObject({conversationId:'c',messageId:'m',approved:true});
 });
 it('Provider 取消信号可中止仍在等待令牌的回答，迟到令牌不会发送',async()=>{
  let issue:(token:string)=>void=()=>{};
  const token=vi.fn(()=>new Promise<string>(resolve=>{issue=resolve;}));
  const network=vi.fn<typeof fetch>(async()=>json({success:true}));
  const client=new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',fetch:network,auth:{type:'token',tokenProvider:token}});
  const controller=new AbortController();
  const wrapper=({children}:{children:ReactNode})=><AiChatContextProvider value={{httpClient:client,signal:controller.signal}}>{children}</AiChatContextProvider>;
  const {result}=renderHook(()=>useSubmitUserInputAnswer(client),{wrapper});
  const response=result.current({questionId:'q',conversationId:'c',messageId:'m',selectedOptions:['A'],customInput:null});
  const failure=response.catch((error:unknown)=>error);
  await waitFor(()=>expect(token).toHaveBeenCalledTimes(1));
  controller.abort();
  expect(await failure).toMatchObject({kind:'cancelled'});
  issue('late-token');
  await Promise.resolve();
  expect(network).not.toHaveBeenCalled();
 });
 it('会话分组日期直接由 SDK 返回为 Date',async()=>{
  const network=vi.fn<typeof fetch>(async()=>json({records:[{id:1,name:'分组',createdTime:'2026-10-21T00:00:00Z',lastUpdateTime:'2026-10-21T00:01:00Z'}]}));
  const client=clientWith(network);
  const {result}=renderHook(()=>useConversationOperations({httpClient:client}));
  const groups=await result.current.getConversationGroups();
  expect(groups.records[0]?.createdTime).toBeInstanceOf(Date);
  expect(groups.records[0]?.lastUpdateTime).toBeInstanceOf(Date);
 });
});

it('工作区按 SDK 路径查询预览，列表日期保持 SDK Date',async()=>{
 const network=vi.fn<typeof fetch>(async(input)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  if(url.pathname.endsWith('/preview'))return json({url:'https://storage.test/read'});
  return json({fileArtifacts:{records:[{relativePath:'reports/中文.pdf',size:42,fileName:'中文.pdf',mimeType:'application/pdf',lastUpdateTime:'2026-10-21T00:00:00Z'}],page:{current:0,size:20,total:1,totalPages:1}},nonFileArtifacts:[]});
 });
 const client=clientWith(network);
 const {result}=renderHook(()=>({list:useWorkspaceFiles({httpClient:client}),preview:useWorkspaceFilePreviewUrlCallback({httpClient:client})}));
 const list=await result.current.list('conversation',{current:0,size:20});
 expect(list.fileArtifacts.records[0]?.lastUpdateTime).toBeInstanceOf(Date);
 expect(list.fileArtifacts.records[0]).not.toHaveProperty('fileId');
 expect(await result.current.preview('conversation','reports/中文.pdf')).toEqual({url:'https://storage.test/read'});
 const request=network.mock.calls[1]?.[0];
 if(!(request instanceof Request))throw new Error('SDK 应使用 Request');
 expect(new URL(request.url).searchParams.get('path')).toBe('reports/中文.pdf');
});
it('同一 SDK 实例切换身份时隔离缓存并取消旧生命周期',async()=>{
 const client=clientWith(vi.fn<typeof fetch>(async()=>json({})));
 const snapshots=new Map<string,{key:string;signal:AbortSignal|undefined}>();
 function Probe({id}:{id:string}) {
  const {signal}=useAiChatContext();
  const key=useChatClientCacheKey(client,'workspace','same-conversation');
  useEffect(()=>{snapshots.set(id,{key,signal});setCache(key,1000,{data:id,time:Date.now(),params:[]});},[id,key,signal]);
  return <span>{id}</span>;
 }
 const view=render(<AgentProvider client={client} identityKey="a"><Probe id="a"/></AgentProvider>);
 const old=snapshots.get('a');expect(old).toBeDefined();
 view.rerender(<AgentProvider client={client} identityKey="b"><Probe id="b"/></AgentProvider>);
 await waitFor(()=>expect(old?.signal?.aborted).toBe(true));
 const current=snapshots.get('b');expect(current?.key).not.toBe(old?.key);
 expect(current?.signal?.aborted).toBe(false);
 expect(old?getCache(old.key):null).toBeUndefined();
 expect(current?getCache(current.key)?.data:null).toBe('b');
 view.unmount();
 await waitFor(()=>expect(current?.signal?.aborted).toBe(true));
 expect(current?getCache(current.key):null).toBeUndefined();
});
it('StrictMode 重演不提前取消当前 Provider',async()=>{
 const client=clientWith(vi.fn<typeof fetch>(async()=>json({})));
 let signal:AbortSignal|undefined;
 function Probe(){signal=useAiChatContext().signal;return null;}
 const view=render(<StrictMode><AgentProvider client={client} identityKey="a"><Probe/></AgentProvider></StrictMode>);
 await act(async()=>{await Promise.resolve();});
 expect(signal?.aborted).toBe(false);
 view.unmount();
 await waitFor(()=>expect(signal?.aborted).toBe(true));
});

it('普通演示的配置、历史、事件与工作区直接使用 SDK',async()=>{
 const {createDemoClient}=await import('../packages/registry/src/examples/mock-client');
 const client=createDemoClient();
 expect((await client.configuration.getAgentsConfig()).modelConfig.modelKeyGroups[0]?.models[0]?.modelName).toBe('demo');
 const conversations=await client.conversations.listConversations();
 expect(conversations.records[0]?.createdTime).toBeInstanceOf(Date);
 const messages=await client.messages.listConversationMessages('demo');
 expect(messages.records[0]?.userMessage.executionType).toBe('USER_MESSAGE');
 expect(messages.records[0]?.usage.totalTokens).toBe(120);
 const events=await client.events.getChatEventsBatch({conversationId:'demo',messageIds:['history-1']});
 expect(events.records[0]?.events.map(event=>event.type)).toEqual(['start','message','end']);
 expect(events.skipped).toEqual([]);
 const workspace=await client.workspace.listWorkspaceArtifacts('demo');
 expect(workspace.fileArtifacts.records[0]?.relativePath).toBe('guide.md');
 const submission=await client.chat.createChat({query:'测试回复'});
 const subscription=client.chat.subscribeChatEvents(submission.conversationId,{messageId:submission.messageId});
 const types:string[]=[];for await(const event of subscription)types.push(event.type);
 expect(types).toEqual(['start','message','end']);
 expect((await subscription.closed).reason).toBe('end');
});
