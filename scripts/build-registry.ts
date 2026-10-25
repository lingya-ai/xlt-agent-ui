import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { registryItemSchema } from "shadcn/schema";

const root = process.cwd();
const source = path.join(root, "packages/registry/src");
const version = JSON.parse(await readFile("package.json", "utf8")).version as string;
const origin = (process.env.REGISTRY_ORIGIN ?? "http://localhost:4602").replace(/\/$/, "");
const output = path.join(root, "apps/docs/public/r", version);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile("package.json", "utf8")) as { dependencies: Record<string, string> };
const entries: Record<string, { description: string; roots: string[] }> = {
  "agent-demo": { description: "普通聊天、完整工作台、历史只读与目标模式的本地模拟示例", roots: ["examples/demo.tsx"] },
  "agent-styles": { description: "语义别名与 Chromium 102 CSS 后处理", roots: ["styles/agent.css", "styles/postcss-chromium102.cjs"] },
  "agent-client": { description: "SDK 标准客户端、公开类型与契约索引", roots: ["openapi/client.ts", "openapi/endpoints.ts"] },
  "agent-server": { description: "服务端签名、短期令牌签发与认证 Handler", roots: ["openapi/presign.server.ts"] },
  "agent-session": { description: "流式事件、历史恢复、完整接口 Hook 与身份 Provider", roots: ["openapi/provider.tsx", "openapi/use-operation.ts", "ai/hooks/use-chat/use-chat.ts"] },
  "agent-messages": { description: "消息、工具过程、引用和执行状态渲染", roots: ["ai/agents/agents-chat-message.tsx"] },
  "agent-composer": { description: "输入框、附件、模型、目标模式与发送控制", roots: ["ai/agents/agents-chat-input.tsx"] },
  "agent-conversations": { description: "会话目录、分组、标题、归档与活动状态", roots: ["ai/agents/conversation-list.tsx", "ai/hooks/use-chat/use-conversation-activity.ts"] },
  "agent-interactions": { description: "计划审批与用户回答", roots: ["ai/agents/plan-approval-block.tsx", "ai/agents/tool-awaiting-input.tsx"] },
  "agent-goal-demo": { description: "目标创建与完整生命周期模拟接入示例", roots: ["examples/goal-demo.tsx", "examples/mock-client.ts", "openapi/provider.tsx"] },
  "agent-goal": { description: "目标编辑、运行控制与历史", roots: ["ai/agents/agent-goal-bar.tsx", "ai/agents/agent-goal-details.tsx"] },
  "agent-async-tasks": { description: "异步任务和通知同步", roots: ["ai/agents/agents-chat-async-tasks.tsx", "ai/hooks/use-chat/use-agent-async-tasks.ts"] },
  "agent-subagents": { description: "子 Agent、结果和取消控制", roots: ["ai/agents/workspace-subagents.tsx", "ai/agents/workspace-subagent-detail.tsx"] },
  "agent-workspace": { description: "制品目录、工作区与文件预览", roots: ["ai/agents/workspace-controller.tsx", "ai/agents/workspace-content-tabs.tsx"] },
  "agent-files": { description: "附件上传和多格式文件预览", roots: ["ai/hooks/use-chat/use-upload-chat-attachment.ts", "file-preview/components/file-preview.tsx", "integration/file-previews.tsx"] },
  "agent-citations": { description: "知识引用展示和元数据查询", roots: ["ai/components/knowledge-citation-sheet.tsx", "ai/hooks/use-chat/use-citation-metadata.ts"] },
  "agent-sql": { description: "SQL 数据分页、图表与导出", roots: ["ai/agents/sql-query-result.tsx", "ai/agents/sql-chart-result.tsx", "integration/sql-charts.tsx"] },
  "agent-chat": { description: "基础聊天组合，重型预览与图表按需安装", roots: ["blocks/agent-chat.tsx", "openapi/provider.tsx", "openapi/client.ts"] },
  "agent-chat-workbench": { description: "完整开放渠道工作台和全部公开契约", roots: ["blocks/agent-chat-workbench.tsx", "openapi/provider.tsx", "openapi/use-operation.ts"] },
  "agent-history": { description: "历史只读与事件回放", roots: ["ai/agents/agents-conversation-replay.tsx", "openapi/provider.tsx"] },
};
const externalUi = new Set(["ui/components/separator.tsx", "ui/components/skeleton.tsx"]);
const imports = /(?:from\s*|import\s*\(\s*|import\s*)["']([^"']+)["']/g;
async function exists(file: string) { try { await access(file); return true; } catch { return false; } }
async function resolve(file: string) {
  for (const candidate of [file, `${file}.ts`, `${file}.tsx`, path.join(file, "index.ts"), path.join(file, "index.tsx")]) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`无法解析 Registry 文件 ${file}`);
}
const catalog = [];
const sourceCatalog = [];
const hashes: Record<string, string> = {};
const notices = await Promise.all(["THIRD_PARTY_NOTICES.md", "licenses/shadcn-ui-MIT.txt", "licenses/ai-elements-LICENSE.txt", "licenses/Apache-2.0.txt"].map(async file => ({
  path: file, type: "registry:file" as const, target: `@components/xlt-agent/${file}`, content: await readFile(file, "utf8"),
})));
// 基础 UI 同样固定为当前版本快照，避免官方 latest 改变已发布闭包。
for (const name of ["separator", "skeleton"]) {
  const content = (await readFile(path.join(source, `ui/components/${name}.tsx`), "utf8")).replaceAll("../lib/utils", "@/lib/utils");
  const packageName = "@radix-ui/react-separator";
  const dependencies = name === "separator" ? [`${packageName}@${JSON.parse(await readFile(path.join(root, "node_modules", packageName, "package.json"), "utf8")).version}`] : [];
  const item = registryItemSchema.parse({name: `base-${name}`, type: "registry:ui", dependencies,
    files: [{path: `registry/new-york/ui/${name}.tsx`, type: "registry:ui", content}, ...notices],
    meta: {version, upstream: "shadcn/ui", license: "MIT"}});
  const serialized = JSON.stringify(item, null, 2) + "\n";
  const destination = path.join(output, `base-${name}.json`);
  if (process.env.REGISTRY_DEV !== "1" && await exists(destination) && await readFile(destination, "utf8") !== serialized) throw new Error(`版本 ${version} 的基础 UI 已冻结`);
  await writeFile(destination, serialized);
  hashes[`base-${name}`] = createHash("sha256").update(serialized).digest("hex");
  catalog.push({...item, files: item.files?.map(({content: _content, ...file}) => file)});
  sourceCatalog.push({...item, files: item.files?.map(({content: _content, ...file}) => file)});
}
for (const [name, entry] of Object.entries(entries)) {
  const visited = new Set<string>();
  const dependencies = new Set<string>();
  const registryDependencies = new Set<string>();
  const files: { path: string; type: "registry:file" | "registry:component"; target: string; content: string }[] = [];
  async function visit(file: string) {
    file = await resolve(file);
    if (visited.has(file)) return;
    visited.add(file);
    const relative = path.relative(source, file).replaceAll("\\", "/");
    if (!file.startsWith(source + path.sep)) throw new Error(`源码越界 ${file}`);
    if (externalUi.has(relative)) {
      registryDependencies.add(`${origin}/r/${version}/base-${path.basename(file, ".tsx")}.json`);
      return;
    }
    const original = await readFile(file, "utf8");
    let content = original;
    const matches = [...original.matchAll(imports)];
    for (const match of matches) {
      const spec = match[1]!;
      if (spec.startsWith(".")) {
        const dependency = await resolve(path.resolve(path.dirname(file), spec));
        const dependencyRelative = path.relative(source, dependency).replaceAll("\\", "/");
        await visit(dependency);
        if (externalUi.has(dependencyRelative)) content = content.replaceAll(spec, `@/components/ui/${path.basename(dependency, ".tsx")}`);
      } else if (!spec.startsWith("node:")) {
        const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
        const range = manifest.dependencies[pkg];
        if (!range && !["react", "react-dom"].includes(pkg)) throw new Error(`缺少 npm 依赖 ${pkg}`);
        if (!["react", "react-dom"].includes(pkg)) dependencies.add(`${pkg}@${JSON.parse(await readFile(path.join(root, "node_modules", pkg, "package.json"), "utf8")).version}`);
      }
    }
    files.push({ path: `packages/registry/src/${relative}`, type: /\.tsx?$/.test(relative) ? "registry:component" : "registry:file", target: `@components/xlt-agent/${relative}`, content });
  }
  for (const entrypoint of entry.roots) await visit(path.join(source, entrypoint));
  if (["agent-client", "agent-chat", "agent-composer"].includes(name) &&
    [...dependencies].some(dependency => /^(echarts|pdfjs-dist|exceljs|docx-preview|@file-viewer\/pptx)@/.test(dependency))) {
    throw new Error(`${name} 不得隐式引入重型预览和图表依赖`);
  }
  if (files.some(file => file.path.endsWith(".tsx"))) {
    await visit(path.join(source, "styles/agent.css"));
    await visit(path.join(source, "styles/postcss-chromium102.cjs"));
  }
  const item = registryItemSchema.parse({
    $schema: "https://ui.shadcn.com/schema/registry-item.json", name, type: "registry:block", title: name,
    description: entry.description, dependencies: [...dependencies].sort(), registryDependencies: [...registryDependencies].sort(),
    files: [...files.sort((a, b) => a.path.localeCompare(b.path)), ...notices],
    meta: { version, contract: "openapi/v1", contractVersion: "0.1.7", sdk: "@lingya-ai/agents-sdk", sdkVersion: "0.7.1", source: "provenance/source.json", sdkSource: "provenance/sdk.json" },
    docs: "安装后导入 AgentProvider 和所需组件；请参阅文档的令牌接入、主题与升级说明。CSS 入口需要由宿主按文档配置。",
  });
  const serialized = JSON.stringify(item, null, 2) + "\n";
  const destination = path.join(output, `${name}.json`);
  // 同一版本存在不同内容时阻止正式发布；本地开发显式设置 REGISTRY_DEV=1 可重建。
  if (process.env.REGISTRY_DEV !== "1" && await exists(destination) && await readFile(destination, "utf8") !== serialized) {
    throw new Error(`版本 ${version} 已包含不同的 ${name}，请更新版本或设置 REGISTRY_DEV=1 进行本地开发`);
  }
  await writeFile(destination, serialized);
  hashes[name] = createHash("sha256").update(serialized).digest("hex");
  catalog.push({ ...item, files: item.files?.map(({ content: _content, ...file }) => file) });
  sourceCatalog.push({ ...item, files: item.files?.map(({ content: _content, ...file }) => file) });
}
const index = { $schema: "https://ui.shadcn.com/schema/registry.json", name: "xlt-agent-ui", homepage: origin, items: catalog };
await writeFile(path.join(output, "registry.json"), JSON.stringify(index, null, 2));
await writeFile("registry.json", JSON.stringify({ ...index, items: sourceCatalog }, null, 2) + "\n");
await writeFile(path.join(output, "checksums.json"), JSON.stringify(hashes, null, 2) + "\n");
console.log(`已生成 ${catalog.length} 个 Registry 条目：${output}`);
