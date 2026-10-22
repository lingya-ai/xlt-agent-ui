// 一次性将来源字典转为不依赖 Intlayer 的双语数据。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const fe = path.resolve(root, '../xiaolingtong-fe');
const ts = require(path.join(fe, 'node_modules/typescript'));
const src = path.join(root, 'packages/registry/src');
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]); }
const dictionaries = {};
for (const pkg of ['ai','ui','file-preview','api']) {
  for (const f of walk(path.join(fe,'packages',pkg,'src')).filter(x=>x.endsWith('.content.ts'))) {
    const module = {exports:{}};
    const code=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    const declarations={t:locales=>({locales:Object.fromEntries(Object.entries(locales).map(([k,v])=>[k,v?.template??v])),...(Object.values(locales).some(v=>v?.insert)?{insert:true}:{})}),insert:node=>typeof node==='string'?{template:node,insert:true}:({...node,insert:true})};
    try {
      vm.runInNewContext(code,{exports:module.exports,module,require:()=>declarations});
      const value=module.exports.default;
      if(value?.key) dictionaries[value.key]=value.content;
    } catch(error) { throw new Error(f+': '+error.message); }
  }
}
const used=new Set();
for(const f of walk(src).filter(x=>/\.(ts|tsx)$/.test(x)&&!x.includes('.test.'))) {
 const s=fs.readFileSync(f,'utf8');
 for(const match of s.matchAll(/(?:useIntlayer|useAgentMessages)\(["']([^"']+)["']\)/g)) used.add(match[1]);
}
const data=Object.fromEntries([...used].sort().map(key=>{if(!dictionaries[key])throw new Error('缺失字典 '+key);return [key,dictionaries[key]];}));
fs.mkdirSync(path.join(src,'i18n'),{recursive:true});
fs.writeFileSync(path.join(src,'i18n/messages.ts'),'// 来源字典的一次性转换；后续直接维护此双语数据\nexport const messages = '+JSON.stringify(data,null,2)+' as const;\n');
for (const f of walk(src)) {
 if(f.endsWith('.content.ts')) {fs.unlinkSync(f);continue;}
 if(/\.(ts|tsx)$/.test(f))fs.writeFileSync(f,fs.readFileSync(f,'utf8').replaceAll('useIntlayer','useAgentMessages').replaceAll('useLocale','useAgentLocale'));
}
console.log('已转换字典',used.size);
