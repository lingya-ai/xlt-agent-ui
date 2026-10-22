"""一次性移植当前工作树，记录每个来源文件的摘要，不参与 Registry 构建。"""
from pathlib import Path
import re, json, hashlib, subprocess, os

ROOT = Path(__file__).resolve().parents[1]
FE = ROOT.parent / 'xiaolingtong-fe'
BE = ROOT.parent / 'xiaolingtong-be'
DEST = ROOT / 'packages/registry/src'
packages = {p: FE / 'packages' / p for p in ['ai','api','ui','file-preview','charts']}
manifests = {p: json.loads((d/'package.json').read_text()) for p,d in packages.items()}
seen = set()
records = []
imports = re.compile(r'''(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']''')

def resolve(base):
    for candidate in [base,Path(str(base)+'.ts'),Path(str(base)+'.tsx'),base/'index.ts',base/'index.tsx']:
        if candidate.is_file(): return candidate.resolve()
    raise RuntimeError('无法解析 '+str(base))

def locate(spec, source):
    if spec.startswith('.'):
        return resolve(source.parent/spec.split('?')[0])
    if spec.startswith('@workspace/'):
        p,_,sub = spec[len('@workspace/'):].partition('/')
        if p not in packages: return None
        exports = manifests[p]['exports']
        key = './'+sub
        if key in exports: return resolve(packages[p]/exports[key])
        for pattern,target in sorted(exports.items(),key=lambda pair:-len(pair[0])):
            if '*' in pattern:
                match=re.fullmatch(re.escape(pattern).replace(r'\*','(.+)'),key)
                if match:
                    for group in match.groups():target=target.replace('*',group,1)
                    return resolve(packages[p]/target)
        raise RuntimeError(spec)
    return None

def target(source):
    p = source.relative_to(FE/'packages')
    return DEST/p.parts[0]/Path(*p.parts[2:])

def visit(source):
    if source in seen: return
    seen.add(source)
    content=source.read_text(encoding='utf-8-sig')
    records.append({'source':source.relative_to(FE).as_posix(),'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
    out=target(source)
    def change(match):
        spec=match.group(1)
        if spec in ['next-intlayer','intlayer']:
            dest=DEST/'i18n'/('runtime' if spec=='next-intlayer' else 'declarations')
        elif spec.startswith('@workspace/access/'):
            dest=DEST/'integration/access'
        elif spec=='@workspace/client-telemetry/events':
            dest=DEST/'integration/events'
        else:
            dest=locate(spec,source)
            if dest:
                visit(dest)
                dest=target(dest)
        if dest:
            path=os.path.relpath(dest,out.parent).replace('\\','/')
            path=re.sub(r'\.(tsx?|jsx?)$','',path)
            if not path.startswith('.'):path='./'+path
            return match.group(0).replace(spec,path)
        return match.group(0)
    content=imports.sub(change,content)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(content,encoding='utf-8')
    if not source.name.endswith('.content.ts'):
        sibling=source.with_name(re.sub(r'\.(tsx?|jsx?)$','.content.ts',source.name))
        if sibling.is_file(): visit(sibling.resolve())

roots=['agents/agents-chat.tsx','agents/conversation-list.tsx','agents/agents-conversation-replay.tsx']
for root in roots:visit((packages['ai']/'src'/root).resolve())
for f in (packages['ai']/'src/hooks/use-chat').glob('*.ts'):
    if '.test' not in f.name and f.name not in ['use-conversation-shares.ts']:visit(f.resolve())
# 保留直接覆盖公开能力的来源测试；不复制依赖内部 RBAC 的测试。
for source in list(seen):
    for test in [source.with_suffix('.test.ts'),source.with_suffix('.test.tsx')]:
        if test.is_file() and 'use-ai-chat-access' not in test.name:
            visit(test.resolve())
for p in ['ai','api','ui','file-preview','charts']:
    print(p, sum(1 for x in seen if x.is_relative_to(packages[p])))
(ROOT/'provenance').mkdir(exist_ok=True)
provenance={'frontendCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=FE,text=True).strip(),'backendCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=BE,text=True).strip(),'frontendWorkingTree':subprocess.check_output(['git','status','--porcelain'],cwd=FE,text=True),'backendWorkingTree':subprocess.check_output(['git','status','--porcelain'],cwd=BE,text=True),'files':sorted(records,key=lambda x:x['source'])}
(ROOT/'provenance/source.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
deps={}
for manifest in manifests.values():
    for key,value in manifest.get('dependencies',{}).items():
        if not key.startswith('@workspace/'):deps[key]=value
(ROOT/'provenance/dependencies.json').write_text(json.dumps(deps,indent=2)+'\n')
