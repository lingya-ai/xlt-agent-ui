import {act,renderHook,waitFor} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import {AgentsClient} from "@lingya-ai/agents-sdk/browser";
import {useChatMessages} from "../packages/registry/src/ai/hooks/use-chat/use-chat-messages";
const metadata={messageId:"m1",executionType:"USER_MESSAGE",userMessage:{type:"USER",metadata:{},text:"hello",executionType:"USER_MESSAGE"},usage:{inputTokens:2,outputTokens:3,totalTokens:5},status:"COMPLETED",inputTokens:2,outputTokens:3,totalTokens:5,
  processingSteps:1,totalToolCalls:0,executionTimeMillis:10,createdTime:"2026-10-20T08:00:00Z",lastUpdateTime:"2026-10-20T08:00:00Z"};
const event=(type:string,sequence:number,extra:Record<string,unknown>={})=>({type,sequence,conversationId:"c1",messageId:"m1",...extra});
const response=(values:unknown[])=>new Response(values.map(value=>`data: ${JSON.stringify(value)}\n\n`).join(""),{headers:{"Content-Type":"text/event-stream"}});
const client=(transport:typeof fetch)=>new AgentsClient({baseUrl:"https://test.invalid",channelId:"public",fetch:transport,auth:{type:"token",tokenProvider:()=>"one-use"}});
it("断流以同一消息重新订阅，从流头重建而不重复提交用户输入",async()=>{
  let subscriptions=0;
  const transport=vi.fn<typeof fetch>(async(input)=>{
    if(!(input instanceof Request))throw new Error("SDK 应使用 Request");
    if(new URL(input.url).pathname.endsWith("/stream")){
      expect(await input.clone().json()).toEqual({messageId:"m1"});
      subscriptions++;
      return response(subscriptions===1?[event("start",0),event("message",1,{message:"半截"})]:[
        event("start",0),event("message",1,{message:"完整回复"}),event("end",2,{executionTimeMillis:10,totalUsage:{inputTokens:2,outputTokens:3,totalTokens:5},artifacts:[],nonFileArtifacts:[]})]);
    }
    return new Response(JSON.stringify(metadata),{headers:{"Content-Type":"application/json"}});
  });
  const clientInstance=client(transport);
  const hook=renderHook(()=>useChatMessages({httpClient:clientInstance}));
  let finished:Promise<void>;
  await act(async()=>{finished=hook.result.current.runStream({conversationId:"c1",messageId:"m1",query:"hello"});});
  await waitFor(()=>expect(subscriptions).toBe(2),{timeout:4000});
  await act(async()=>{await finished;});
  expect(hook.result.current.chatList).toHaveLength(1);
  const assistant=hook.result.current.chatList[0]!.assistant;
  expect(JSON.stringify(assistant)).toContain("完整回复");
  expect(JSON.stringify(assistant)).not.toContain("半截");
  expect(transport.mock.calls.filter(([url])=>url instanceof Request && new URL(url.url).pathname.endsWith("/chat"))).toHaveLength(0);
  hook.unmount();
});

it("401 的流失败直接收口，不重新订阅或重放发送",async()=>{
  const transport=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({message:"expired"}),{status:401,headers:{"Content-Type":"application/json"}}));
  const clientInstance=client(transport);
  const hook=renderHook(()=>useChatMessages({httpClient:clientInstance}));
  await act(async()=>{await expect(hook.result.current.runStream({conversationId:"c1",messageId:"m1"})).rejects.toThrow();});
  const requests=transport.mock.calls.map(([input])=>{if(!(input instanceof Request))throw new Error('SDK 应使用 Request');return new URL(input.url).pathname;});
  expect(requests.filter(path=>path.endsWith('/stream'))).toHaveLength(1);
  expect(requests.filter(path=>path.endsWith('/chat'))).toHaveLength(0);
  expect(hook.result.current.isResponding).toBe(false);
});
