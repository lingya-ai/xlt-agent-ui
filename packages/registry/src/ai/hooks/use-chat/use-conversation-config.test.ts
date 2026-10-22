import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import {describe,expect,it,vi} from 'vitest';
import {requestConversationConfig} from './use-conversation-config';

describe('requestConversationConfig',()=>{
 it('直接使用 SDK 配置响应，保留显式模式与模型选项',async()=>{
  const data={lastChatModelSpec:{keyGroupId:2,model:'thinking-model',thinking:true},planMode:false};
  const network=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
  const client=new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',fetch:network,auth:{type:'token',tokenProvider:()=> 'one-use'}});
  const result=await requestConversationConfig(client,'conversation-1');
  expect(result).toMatchObject(data);
  const request=network.mock.calls[0]?.[0];
  if(!(request instanceof Request))throw new Error('SDK 应使用 Request');
  expect(new URL(request.url).pathname).toBe('/api/agents/channel/openapi/v1/public/chat/conversations/conversation-1/config');
 });
 it('将取消交给 SDK，已取消请求不进入网络',async()=>{
  const network=vi.fn<typeof fetch>();
  const client=new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',fetch:network,auth:{type:'token',tokenProvider:()=> 'one-use'}});
  const controller=new AbortController();controller.abort();
  await expect(requestConversationConfig(client,'c',{signal:controller.signal})).rejects.toMatchObject({kind:'cancelled'});
  expect(network).not.toHaveBeenCalled();
 });
});
