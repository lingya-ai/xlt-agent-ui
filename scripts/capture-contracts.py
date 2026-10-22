"""一次性记录 Controller 契约快照；运行时不读取私有后端。"""
from pathlib import Path
import re,json,hashlib
r=Path(__file__).resolve().parents[1];be=r.parent/'xiaolingtong-be'
files=[be/'apps/agents-server/src/main/kotlin/cc/lingya/xiaolingtong/agents/server/controller/OpenApiChannelChatController.kt']
base=be/'packages/agent-runtime/src/main/kotlin/cc/lingya/xiaolingtong/agentruntime'
files += [base/f for f in ['AbstractAgentsController.kt','AbstractAgentsStreamController.kt','AbstractAgentsConversationReadController.kt']]
records=[];schemas={}
def feature(path):
 if '/goal' in path:return 'agent-goal'
 if 'subagent' in path:return 'agent-subagents'
 if 'async-task' in path:return 'agent-async-tasks'
 if 'sql-query' in path:return 'agent-sql'
 if '/workspace' in path:return 'agent-workspace'
 if '/citations' in path:return 'agent-citations'
 if '/files' in path:return 'agent-files'
 if '/plan' in path or '/user-input' in path:return 'agent-interactions'
 if '/stream' in path or '/events' in path:return 'agent-session'
 if '/conversations' in path or '/conversation-groups' in path:return 'agent-conversations'
 return 'agent-client'
for file in files:
 s=file.read_text(encoding='utf-8-sig');dest=r/'provenance/backend'/file.name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(s,encoding='utf-8')
 for m in re.finditer(r'@(Get|Post|Put|Patch|Delete|Ws)Mapping(?:\((.*?)\))?\s*(?:override\s+|open\s+)*fun\s+(\w+)\(',s,re.S):
  method,attrs,name=m.groups();paths=re.findall(r'"([^"\n]+)"',attrs or '');path=paths[0] if paths else ''
  records.append({'id':name,'method':method.upper(),'path':path,'source':file.name,'line':s[:m.start()].count('\n')+1,'feature':feature(path),'transport':'ws' if method=='Ws' else 'sse' if 'TEXT_EVENT_STREAM' in (attrs or '') else 'server' if name=='presign' else 'download' if name=='exportSqlQueryResult' else 'json'})
out=r/'packages/registry/src/openapi/endpoints.ts';out.write_text('// Controller 快照中的全部开放聊天入口\nexport const endpoints = '+json.dumps({e['id']:{k:v for k,v in e.items() if k not in ['id','source','line']} for e in records},ensure_ascii=False,indent=2)+' as const;\nexport type OpenApiOperation = keyof typeof endpoints;\n',encoding='utf-8')
(r/'provenance/contracts.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('开放接口数量',len(records))
