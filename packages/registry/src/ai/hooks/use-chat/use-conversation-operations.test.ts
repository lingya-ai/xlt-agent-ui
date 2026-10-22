import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import {renderHook} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {requestConversationPage,useConversationOperations} from './use-conversation-operations';
const make=(network:typeof fetch)=>new AgentsClient({baseUrl:'https://sdk.test/gateway',channelId:'public',fetch:network,auth:{type:'token',tokenProvider:()=> 'one-use'}});
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

describe('会话分页与操作直接采用 SDK',()=>{
 it('保留宿主网关前缀，发送 SDK 分页筛选且返回标准分页',async()=>{
  const network=vi.fn<typeof fetch>(async()=>json({records:[],page:{current:0,size:30,total:0,totalPages:0}}));
  const page=await requestConversationPage(make(network),{current:0,size:30,keyword:'合同',groupFilter:'GROUP',groupId:8});
  expect(page.records).toEqual([]);
  const request=network.mock.calls[0]?.[0];if(!(request instanceof Request))throw new Error('SDK 应使用 Request');
  const url=new URL(request.url);
  expect(url.pathname).toBe('/gateway/api/agents/channel/openapi/v1/public/chat/conversations');
  expect(Object.fromEntries(url.searchParams)).toMatchObject({current:'0',size:'30',keyword:'合同',groupFilter:'GROUP',groupId:'8'});
 });
 it('合并同一作用域的并发上下文查询，完成后允许再次刷新',async()=>{
  const client=make(vi.fn<typeof fetch>());
  let resolve:(value:Awaited<ReturnType<typeof client.conversations.getConversationContextUsage>>)=>void=()=>{};
  const request=vi.spyOn(client.conversations,'getConversationContextUsage').mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const {result}=renderHook(()=>useConversationOperations({httpClient:client}));
  const first=result.current.getConversationContextUsage('c');const second=result.current.getConversationContextUsage('c');
  expect(request).toHaveBeenCalledTimes(1);
  const usage={systemPromptTokens:1000,sessionMessageTokens:2000,maxContextTokens:8000,toolDefinitionTokens:500,protocolReserveTokens:100,activeContextTokens:3600,requestedOutputTokens:4500,messageAssemblyReserveTokens:200,requiredContextTokens:8300,activeUsageRatio:0.45,requiredUsageRatio:1.0375,calculationSource:'PROVIDER_ANCHORED'};
  resolve(usage);expect(await first).toBe(usage);expect(await second).toBe(usage);
  const third=result.current.getConversationContextUsage('c');expect(request).toHaveBeenCalledTimes(2);resolve(usage);await third;
 });
 it('拒绝无效的分页表单，直接传递 SDK 错误',async()=>{
  const network=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({code:'FORBIDDEN',message:'不可读取'}),{status:403,headers:{'Content-Type':'application/json'}}));
  const client=make(network);
  expect(()=>requestConversationPage(client,{size:0})).toThrow();
  expect(network).not.toHaveBeenCalled();
  await expect(requestConversationPage(client,{})).rejects.toMatchObject({kind:'http',status:403,code:'FORBIDDEN'});
  expect(network).toHaveBeenCalledTimes(1);
 });
});
