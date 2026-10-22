import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import {renderHook} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {useCitationMetadata} from './use-citation-metadata';

describe('useCitationMetadata',()=>{
 it('直接提交公开 ReturnedReference，返回 SDK records',async()=>{
  const payload={records:[{type:'ENTITY',referenceId:30156,title:'企业',description:'企业描述'}]};
  const network=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}}));
  const client=new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',fetch:network,auth:{type:'token',tokenProvider:()=> 'one-use'}});
  const {result}=renderHook(()=>useCitationMetadata(client));
  expect(await result.current([{type:'ENTITY',referenceId:30156}])).toEqual(payload.records);
  const request=network.mock.calls[0]?.[0];if(!(request instanceof Request))throw new Error('SDK 应使用 Request');
  expect(await request.json()).toEqual([{type:'ENTITY',referenceId:30156}]);
  expect(new URL(request.url).pathname).toContain('/knowledge-bases/citations/metadata');
 });
});
