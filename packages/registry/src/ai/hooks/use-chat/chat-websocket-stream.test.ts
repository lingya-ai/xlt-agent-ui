import {AgentsClient,type AgentsClientOptions} from '@lingya-ai/agents-sdk/browser';
import {describe,expect,it,vi} from 'vitest';

type Socket=ReturnType<NonNullable<AgentsClientOptions['webSocketFactory']>>;
function fixture(frames:unknown[]) {
 const factory=vi.fn<NonNullable<AgentsClientOptions['webSocketFactory']>>(()=>{
  const socket:Socket={onopen:null,onmessage:null,onerror:null,onclose:null,close:vi.fn()};
  setTimeout(()=>{socket.onopen?.({});for(const frame of frames)socket.onmessage?.({data:JSON.stringify(frame)});},0);
  return socket;
 });
 const token=vi.fn(()=> 'single-use');
 const client=new AgentsClient({baseUrl:'https://sdk.test/gateway',channelId:'public',auth:{type:'token',tokenProvider:token},webSocketFactory:factory});
 return {client,factory,token};
}
describe('UI 使用 SDK WebSocket 订阅',()=>{
 it('由 SDK 构造路径、令牌子协议和控制帧生命周期，不伪造 End',async()=>{
  const {client,factory,token}=fixture([{id:'message?1',event:'ready'},{id:'message?1',event:'message',data:{type:'message',message:'你好'}},{id:'message?1',event:'complete'}]);
  const diagnostic=vi.fn();
  const subscription=client.chat.subscribeChatEvents('conversation/一',{messageId:'message?1'},{transport:'websocket',onConnectionEvent:diagnostic});
  const events=[];for await(const event of subscription)events.push(event);
  expect(events).toEqual([{type:'message',message:'你好'}]);
  expect(await subscription.closed).toMatchObject({reason:'complete'});
  const url=new URL(factory.mock.calls[0]?.[0]??'');
  expect(url.protocol).toBe('wss:');
  expect(url.pathname).toBe('/gateway/api/agents/channel/openapi/v1/public/chat/conversations/conversation%2F%E4%B8%80/stream/ws');
  expect(url.searchParams.get('messageId')).toBe('message?1');
  expect(factory.mock.calls[0]?.[1].protocols).toEqual(['xlt-openapi-token.single-use']);
  expect(token).toHaveBeenCalledTimes(1);
  expect(diagnostic.mock.calls.map(call=>call[0].type)).toEqual(['opened','ready','closed']);
 });
 it('错误消息 ID 由 SDK 作为协议错误结束，不交付业务事件',async()=>{
  const {client}=fixture([{id:'other',event:'ready'}]);
  const subscription=client.chat.subscribeChatEvents('c',{messageId:'m'},{transport:'websocket'});
  await expect((async()=>{for await(const _event of subscription){throw new Error('不应交付事件');}})()).rejects.toMatchObject({kind:'protocol'});
  expect(await subscription.closed).toMatchObject({reason:'error',error:{kind:'protocol'}});
 });
});
