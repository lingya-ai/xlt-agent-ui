import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {createHash} from "node:crypto";
const root = process.cwd();
const run = (args: string[], cwd: string) => new Promise<void>((resolve, reject) => {
  const child = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {cwd, shell: process.platform === "win32", stdio: "inherit"});
  child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${args.join(" ")} 退出码 ${code}`)));
});
const write = async (directory: string, file: string, value: string) => {const destination = path.join(directory, file); await mkdir(path.dirname(destination),{recursive:true}); await writeFile(destination,value);};
await mkdir("artifacts", {recursive:true});
// SDK 尚未发布，隔离的本地 npm fixture 仅提供该 SDK 的真实 tarball，其他依赖照常安装。
const sdkBytes = await readFile(path.join(root, ".cache/sdk/lingya-ai-agents-sdk-0.7.0.tgz"));
const sdkProvenance = JSON.parse(await readFile("provenance/sdk.json", "utf8")) as {version:string;localTarballSha256:string};
if (createHash("sha256").update(sdkBytes).digest("hex") !== sdkProvenance.localTarballSha256) throw new Error("SDK 包摘要与来源记录不一致");
const sdkPackage = JSON.parse(await readFile(path.join(root, "node_modules/@lingya-ai/agents-sdk/package.json"), "utf8"));
if (sdkPackage.version !== sdkProvenance.version) throw new Error("SDK 版本与来源记录不一致");
const sdkRegistry = createServer((request,response) => {
  if (request.url === "/sdk.tgz") { response.setHeader("Content-Type","application/octet-stream"); response.end(sdkBytes); return; }
  if (decodeURIComponent((request.url ?? "").split("?")[0]!) !== "/@lingya-ai/agents-sdk") {response.writeHead(404).end(); return;}
  const address = sdkRegistry.address();
  if (!address || typeof address === "string") {response.writeHead(503).end(); return;}
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({name:sdkPackage.name,"dist-tags":{latest:sdkPackage.version},versions:{[sdkPackage.version]:{...sdkPackage,dist:{tarball:`http://127.0.0.1:${address.port}/sdk.tgz`,shasum:createHash("sha1").update(sdkBytes).digest("hex")}}}}));
});
await new Promise<void>(resolve => sdkRegistry.listen(0,"127.0.0.1",resolve));
const sdkAddress = sdkRegistry.address();
if (!sdkAddress || typeof sdkAddress === "string") throw new Error("本地 SDK Registry 未启动");
try {
for (const framework of ["vite", "next"] as const) {
  const directory = path.join(root, ".cache/consumers/0.2.0", framework);
  const alias = framework === "vite" ? "~" : "@";
  const manifest = {name:`xlt-install-${framework}`,private:true,type:"module",packageManager:"pnpm@10.30.2",
    dependencies:{react:"19.2.0","react-dom":"19.2.0",...(framework === "next" ? {next:"16.1.6"}: {})},
    devDependencies:{typescript:"5.9.3","@types/react":"19.2.0","@types/react-dom":"19.2.0","@types/node":"22.19.0",tailwindcss:"4.1.11","@tailwindcss/postcss":"4.1.11",...(framework === "vite" ? {vite:"6.4.1"}: {})}};
  await write(directory,"package.json",JSON.stringify(manifest,null,2));
  await write(directory,"pnpm-workspace.yaml","packages: []\n");
  await write(directory,".npmrc",`@lingya-ai:registry=http://127.0.0.1:${sdkAddress.port}/\n`);
  await write(directory,"tsconfig.json",JSON.stringify({compilerOptions:{target:"ES2022",lib:["ES2022","DOM","DOM.Iterable"],module:"ESNext",moduleResolution:"Bundler",jsx:"react-jsx",strict:true,noUncheckedIndexedAccess:true,skipLibCheck:true,esModuleInterop:true,noEmit:true,resolveJsonModule:true,baseUrl:".",paths:{[`${alias}/*`]:["src/*"]}},include:["src"]}));
  await write(directory,"components.json",JSON.stringify({$schema:"https://ui.shadcn.com/schema.json",style:"new-york",rsc:framework === "next",tsx:true,tailwind:{config:"",css:"src/styles.css",baseColor:"neutral",cssVariables:true},iconLibrary:"lucide",aliases:{components:`${alias}/shared/components`,ui:`${alias}/shared/components/ui`,utils:`${alias}/lib/utils`,lib:`${alias}/lib`,hooks:`${alias}/hooks`}},null,2));
  await write(directory,"src/styles.css",'@import "tailwindcss";\n');
  await write(directory,"src/lib/utils.ts",'import {clsx, type ClassValue} from "clsx"; import {twMerge} from "tailwind-merge"; export function cn(...values: ClassValue[]) {return twMerge(clsx(values));}\n');
  await run(["install"],directory);
  await run(["exec","shadcn","add","http://localhost:4602/r/0.2.0/agent-demo.json","http://localhost:4602/r/0.2.0/agent-client.json","http://localhost:4602/r/0.2.0/agent-server.json","http://localhost:4602/r/0.2.0/agent-goal-demo.json","--yes","--overwrite"],directory);
  const installed = "src/shared/components/xlt-agent";
  const css = (await readFile("apps/docs/app/globals.css","utf8"))
    .replace('"../../../packages/registry/src/styles/agent.css"','"./shared/components/xlt-agent/styles/agent.css"')
    .replace('"../../../packages/registry/src"','"./shared/components/xlt-agent"');
  await write(directory,"src/styles.css",css);
  await write(directory,"postcss.config.mjs",'import path from "node:path"; export default {plugins:{"@tailwindcss/postcss":{},[path.resolve("./src/shared/components/xlt-agent/styles/postcss-chromium102.cjs")]:{}}};');
  if (framework === "vite") {
    await write(directory,"index.html",'<html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><link rel="icon" href="data:,"/><title>安装验证 Vite</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>');
    await write(directory,"src/main.tsx",'import React from "react"; import {createRoot} from "react-dom/client"; import {AgentDemo} from "./shared/components/xlt-agent/examples/demo"; import "./styles.css"; const root=document.getElementById("root"); if(root) createRoot(root).render(<AgentDemo/>);');
    await write(directory,"vite.config.ts",'import {defineConfig} from "vite"; import {fileURLToPath} from "node:url"; export default defineConfig({resolve:{alias:{"~":fileURLToPath(new URL("./src",import.meta.url))}},esbuild:{jsx:"automatic"},build:{target:"chrome102"}});');
  } else {
    await write(directory,"src/app/layout.tsx",'import type {ReactNode} from "react"; import "../styles.css"; export default function Layout({children}:{children:ReactNode}) {return <html lang="zh-CN"><head><link rel="icon" href="data:,"/></head><body>{children}</body></html>;}');
    await write(directory,"src/app/page.tsx",'import {AgentDemo} from "../shared/components/xlt-agent/examples/demo"; export default function Page(){return <AgentDemo/>;}');
    await write(directory,"next.config.mjs",'export default {devIndicators:false,turbopack:{root:process.cwd()}};');
  }
  await run(["exec","tsc","--noEmit"],directory);
  await run(["exec",framework,"build"],directory);
  await writeFile(`artifacts/install-${framework}.json`,JSON.stringify({framework,alias,directory,installed,typecheck:"passed",build:"passed",registryVersion:"0.2.0",sdkVersion:"0.7.0",sdkSource:"local-tarball"},null,2));
}

} finally { await new Promise<void>((resolve,reject) => sdkRegistry.close(error => error ? reject(error) : resolve())); }
