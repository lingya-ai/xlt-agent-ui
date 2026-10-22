import {type ReactNode} from 'react';
import {render,renderHook} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {AgentsClient,ApiError} from '../packages/registry/src/openapi/client';
import {AgentLocale,AgentMessagesProvider,useAgentMessages} from '../packages/registry/src/i18n/runtime';
import {createAgentTokenHandler} from '../packages/registry/src/openapi/presign.server';
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

describe('SDK 作为公开客户端实现',()=>{
 it('并发请求独立取得一次性令牌，HTTP 错误保持 SDK ApiError',async()=>{
  let issued=0;
  const token=vi.fn(async()=> 'token-'+ ++issued);
  const network=vi.fn<typeof fetch>(async(input)=>{
    if(!(input instanceof Request))throw new Error('SDK 应使用 Request');
    if(new URL(input.url).pathname.endsWith('/config'))return json({modelConfig:{defaultModel:null,modelKeyGroups:[]},supportAttachmentExt:[],maxAttachmentCount:0});
    return json({code:'FORBIDDEN',message:'不可访问',fields:[],requestId:'body-id'},403);
  });
  const client=new AgentsClient({baseUrl:'https://api.example.com',channelId:'channel',fetch:network,auth:{type:'token',tokenProvider:token}});
  const [config,error]=await Promise.all([client.configuration.getAgentsConfig(),client.chat.getGoal('conversation/一').catch((error:unknown)=>error)]);
  expect(config.maxAttachmentCount).toBe(0);expect(error).toBeInstanceOf(ApiError);expect(error).toMatchObject({kind:'http',status:403,code:'FORBIDDEN',message:'不可访问'});
  const requests=network.mock.calls.map(([input])=>{if(!(input instanceof Request))throw new Error('缺少 Request');return input;});
  expect(new Set(requests.map(request=>request.headers.get('X-OpenAPI-Token'))).size).toBe(2);
  expect(requests.some(request=>new URL(request.url).pathname.includes('conversation%2F%E4%B8%80'))).toBe(true);
  expect(token).toHaveBeenCalledTimes(2);expect(network).toHaveBeenCalledTimes(2);
 });
});

describe('文案 Provider',()=>{
  it("默认中文，英文和局部覆盖保持类型和可渲染节点",()=>{
    const basic=renderHook(()=>useAgentMessages("agents-chat"));
    expect(typeof basic.result.current.startConversation.value).toBe("string");
    const wrapper=({children}:{children:ReactNode})=><AgentMessagesProvider locale={AgentLocale.En} messages={{"agents-chat":{startConversation:"Loading custom"}}}>{children}</AgentMessagesProvider>;
    const localized=renderHook(()=>useAgentMessages("agents-chat"),{wrapper});
    expect(localized.result.current.startConversation.value).toBe("Loading custom");
    expect(render(<p>{localized.result.current.startConversation}</p>).getByText("Loading custom")).toBeTruthy();
  });
});

describe('服务端通过 SDK 签发一次性令牌',()=>{
 const credentials={type:'hmac' as const,accessKey:'a'.repeat(32),secretKey:'private-secret'};
 it('身份取自服务端认证，忽略请求体 userId，签名和 presign 由 SDK 完成',async()=>{
  const network=vi.fn<typeof fetch>(async()=>json({token:'short-lived',expiresAt:'2026-10-21T10:00:00Z'}));
  const handler=createAgentTokenHandler({baseUrl:'https://api.example.com/gateway',channelId:'channel',auth:credentials,fetch:network,authenticate:async()=>({id:'用户/42'})});
  const response=await handler(new Request('https://host/api/token',{method:'POST',body:JSON.stringify({userId:'attacker'})}));
  expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({token:'short-lived',expiresAt:'2026-10-21T10:00:00.000Z'});
  const request=network.mock.calls[0]?.[0];if(!(request instanceof Request))throw new Error('SDK 应使用 Request');
  expect(request.url).toBe('https://api.example.com/gateway/api/agents/channel/openapi/v1/channel/chat/presign');
  expect(request.headers.get('X-OpenAPI-User')).toBe(Buffer.from('用户/42').toString('base64url'));
  expect(request.headers.get('X-OpenAPI-Signature')).toMatch(/^[a-f0-9]{64}$/);
  expect(await request.text()).toBe('');expect(request.headers.has('Content-Type')).toBe(false);
 });
 it('未认证时不调用 SDK 网络，响应禁止缓存',async()=>{
  const network=vi.fn<typeof fetch>();
  const handler=createAgentTokenHandler({baseUrl:'https://api.example.com',channelId:'channel',auth:credentials,fetch:network,authenticate:async()=>null});
  const response=await handler(new Request('https://host/api/token'));
  expect(response.status).toBe(401);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(network).not.toHaveBeenCalled();
 });
 it('上游失败返回通用信息，保留 no-store',async()=>{
  const handler=createAgentTokenHandler({baseUrl:'https://api.example.com',channelId:'channel',auth:credentials,fetch:async()=>new Response('private-secret',{status:500}),authenticate:async()=>({id:'authenticated'})});
  const response=await handler(new Request('https://host/api/token'));
  expect(response.status).toBe(502);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(await response.text()).not.toContain('private-secret');
 });
});
