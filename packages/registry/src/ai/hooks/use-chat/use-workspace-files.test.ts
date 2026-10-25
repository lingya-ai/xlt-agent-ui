import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import {renderHook} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {useWorkspaceFiles} from './use-workspace-files';

describe('工作区 SDK 查询',()=>{
 it('按相对路径标识文件，保留分页、日期及未知制品供展示降级',async()=>{
  const payload={fileArtifacts:{records:[{fileId:42,relativePath:'reports/结果.pdf',size:128,fileName:'结果.pdf',mimeType:'application/pdf',lastUpdateTime:'2026-10-13T00:00:00Z'}],page:{current:1,size:10,total:11,totalPages:2}},nonFileArtifacts:[{kind:'FUTURE_ARTIFACT',artifactId:13,title:'未来制品',description:'未知类型',lastUpdateTime:'2026-10-13T00:00:00Z',previewUrl:null}]};
  const network=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}}));
  const client=new AgentsClient({baseUrl:'https://sdk.test',channelId:'public',fetch:network,auth:{type:'token',tokenProvider:()=> 'one-use'}});
  const {result}=renderHook(()=>useWorkspaceFiles({httpClient:client}));
  const response=await result.current('c',{prefix:'reports/',current:1,size:10});
  expect(response.fileArtifacts.records[0]).toMatchObject({relativePath:'reports/结果.pdf',lastUpdateTime:new Date('2026-10-13T00:00:00Z')});
  expect(response.fileArtifacts.records[0]).toHaveProperty('fileId',42);
  expect(response.nonFileArtifacts[0]?.kind).toBe('FUTURE_ARTIFACT');
  const request=network.mock.calls[0]?.[0];if(!(request instanceof Request))throw new Error('SDK 应使用 Request');
  expect(Object.fromEntries(new URL(request.url).searchParams)).toMatchObject({prefix:'reports/',current:'1',size:'10'});
 });
});
