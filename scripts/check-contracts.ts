import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {AgentsClient} from '@lingya-ai/agents-sdk/browser';
import {endpoints} from '../packages/registry/src/openapi/endpoints';
interface Operation {operationId:string;group:string;method:string;relativePath:string;response:{schema:string|null;mediaType:string|null}}
const sdk=JSON.parse(await readFile('provenance/sdk.json','utf8')) as {version:string;contract:string;operations:Operation[];websocket:{path:string}};
const captured=JSON.parse(await readFile('provenance/contracts.json','utf8')) as {id:keyof typeof endpoints;source:string;line:number;path:string;method:string}[];
const client=new AgentsClient({baseUrl:'https://contract.invalid',channelId:'check',auth:{type:'token',tokenProvider:()=>{throw new Error('静态检查不得发起请求');}}});
const problems:string[]=[];
const normalize=(value:string)=>value.replace(/\{[^}]+\}/g,'{}');
const rows:string[]=[];
const used=new Set<string>();
for(const record of captured){
 const endpoint=endpoints[record.id];
 if(!endpoint||endpoint.method!==record.method||endpoint.path!==record.path)problems.push(`路由漂移 ${record.id}`);
 const snapshot=await readFile(`provenance/backend/${record.source}`,'utf8');
 if(!snapshot.includes(`fun ${record.id}(`))problems.push(`Controller 遗漏 ${record.id}`);
 const op=sdk.operations.find(item=>item.method===record.method&&normalize(item.relativePath)===normalize(record.path));
 let method='client.chat.subscribeChatEvents(..., {transport:"websocket"})';
 let schema='SDK AiChatBriefEvent / ConnectionEvent / StreamCloseInfo';
 if(record.method==='WS'){
  if(!sdk.websocket.path.endsWith(record.path))problems.push(`WebSocket 契约漂移 ${record.id}`);
 }else if(!op){problems.push(`SDK 未覆盖 ${record.id}`);}else{
  used.add(op.operationId);
  const group=(client as unknown as Record<string,Record<string,unknown>>)[op.group];
  if(typeof group?.[op.operationId]!=='function')problems.push(`SDK 方法遗漏 ${op.group}.${op.operationId}`);
  method=`client.${op.group}.${op.operationId}`;
  schema=op.response.schema??(op.response.mediaType==='text/event-stream'?'SDK 流事件':'SDK 空响应或下载字节');
 }
 rows.push(`| ${record.id} | ${record.method} ${record.path||'/'} | ${record.source}:${record.line} | ${schema} | ${method} | ${endpoint.feature} |`);
}
if(used.size!==sdk.operations.length)problems.push('SDK 操作存在未关联的后端入口');
async function scan(dir:string):Promise<void>{for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scan(file);else if(/\.(tsx?|css)$/.test(file)){const text=await readFile(file,'utf8');if(/(?:from\s*|import\s*\(\s*)["']@workspace\//.test(text))problems.push(`私有导入 ${file}`);}}}
await scan('packages/registry/src');
if(problems.length)throw new Error(problems.join('\n'));
await mkdir('docs',{recursive:true});
await writeFile('docs/contracts.md',`# OpenAPI 契约覆盖表\n\nSDK ${sdk.version}，契约 ${sdk.contract}。${sdk.operations.length} 个 HTTP 操作及 1 个 WebSocket 入口与后端快照逐项关联。SDK 是类型、请求、认证和流解析的标准实现；UI 不再维护响应 Schema 或路由请求转换层。来源见 provenance/source.json 与 provenance/sdk.json。\n\n| 后端操作 | 相对 /chat 路由 | 后端来源 | SDK Schema | SDK 客户端 | 组件条目 |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n\n基础查询可直接调用 SDK，或将 SDK 方法回调传入 useOpenApiOperation；流由 chat.subscribeChatEvents 提供。缓存、重连和 UI 归并由组件负责。\n\n验证边界：本检查仅证明快照路径、SDK 方法与安装实现逐项对应，不代表每个接口已完成运行验证。tests/sdk-ui.test.tsx 覆盖部分直接接入行为；真实渠道测试及全量 UI 验收仍须独立执行。\n\n不适用：渠道管理、发布和 AK/SK 管理不属于公开聊天契约。异步任务没有独立取消操作；子 Agent 使用 cancelConversationSubagent。\n`);
console.log(`${sdk.operations.length} 个 SDK HTTP 方法及 WebSocket 已对应后端快照；无私有 workspace 导入`);
