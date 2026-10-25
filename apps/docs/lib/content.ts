import {sections} from "../content";

export const version = "0.2.1";
export function registryCommand(item: string) {
  const origin = (process.env.REGISTRY_ORIGIN ?? "http://localhost:4602").replace(/\/$/, "");
  return `pnpm dlx shadcn@4.22.1 add ${origin}/r/${version}/${item}.json`;
}
export const basePath = process.env.NEXT_PUBLIC_DOCS_BASE_PATH ?? "";
export function assetPath(path: string) { return `${basePath}${path}`; }
export type Heading = {id: string; title: string};
export type ContentBlock = {kind: "text" | "code"; value: string; language?: string};
export type Chapter = Heading & {blocks: ContentBlock[]};
export type PageEntry = {href: string; title: string; description: string; group: string; chapters: Chapter[]};

const summaries: Record<string, [string, string, string[]]> = {
  "quick-start": ["开始使用", "把可修改的 Agent 组件源码带进你的 React 项目。", ["准备宿主项目", "安装与客户端配置", "样式与会话身份"]],
  installation: ["开始使用", "按需安装源码条目，控制依赖与集成范围。", ["源码分发方式", "可选能力与组合", "安装与升级"]],
  authentication: ["接入指南", "在服务端签名，在浏览器中获取新的单次使用令牌。", ["服务端签名", "令牌与流式传输", "跨域和安全约束"]],
  goal: ["接入指南", "理解目标创建、版本控制和完整生命周期。", ["目标能力", "控制与冲突处理", "组件与历史"]],
  components: ["接入指南", "核对组件能力、安装条目与后端路由。", ["组件与协议边界", "恢复与授权", "契约覆盖"]],
  theme: ["接入指南", "使用宿主语义令牌，适配明暗主题和浏览器。", ["语义主题", "布局与高度", "Chromium 102 兼容"]],
  i18n: ["接入指南", "切换中英文并按需覆盖组件文案。", ["语言与文案覆盖", "字典与插值"]],
  versions: ["维护与升级", "了解版本约束、源码来源和安全升级流程。", ["当前版本", "不可变 Registry 快照", "升级与发布"]],
  maintenance: ["维护与升级", "追溯来源、保留归属，并完成发布前验证。", ["来源记录", "许可与授权", "维护与验证"]],
};
const chapterStarts: Record<string, number[]> = {
  "quick-start": [0, 1, 6], authentication: [0, 4, 6], installation: [0, 2, 5],
  goal: [0, 2, 4], components: [0, 4, 6], theme: [0, 2, 3], i18n: [0, 2],
  versions: [0, 1, 3], maintenance: [0, 1, 3],
};

export function parseBlocks(body: string): ContentBlock[] {
  return body.split(/(```[\s\S]*?```)/g).flatMap<ContentBlock>(part => {
    if (part.startsWith("```")) return [{kind: "code" as const, language: part.match(/^```([^\n]*)/)?.[1]?.trim() ?? "text", value: part.replace(/^```[^\n]*\n/, "").replace(/```$/, "").trimEnd()}];
    return part.split(/\n\s*\n/).filter(value => value.trim()).map(value => ({kind: "text" as const, value: value.trim()}));
  });
}

export const guides: PageEntry[] = sections.map(section => {
  const [group, description, titles] = summaries[section.slug]!;
  const body = section.body.replaceAll("http://localhost:4602", (process.env.REGISTRY_ORIGIN ?? "http://localhost:4602").replace(/\/$/, ""));
  const blocks = parseBlocks(body);
  // 保持正文原有顺序；标题仅提供阅读结构，不改写接入契约。
  const starts = chapterStarts[section.slug]!;
  const chapters = titles.map((title, index) => ({id: `section-${index + 1}`, title,
    blocks: blocks.slice(starts[index], starts[index + 1] ?? blocks.length)}));
  return {href: `/docs/${section.slug}`, title: section.title, description, group, chapters};
});

export type ComponentDoc = PageEntry & {slug: string; item: string; symbol: string; code: string; props: [string, string, string][]; note: string};
const providerHint = "示例需要放在 AgentProvider 内。先完成快速开始中的客户端、单次令牌和样式配置；外层容器必须有明确高度。";
const definitions = [
  {slug: "chat", title: "聊天", symbol: "AgentChat", item: "agent-chat", path: "blocks/agent-chat", description: "组合消息、输入、流式恢复与审批，快速嵌入完整聊天体验。", props: [["conversationId", "string", "传入会话 ID 恢复已有会话。"], ["readOnly", "boolean", "只读展示，默认 false。"], ["input", "AgentsChatProps[\"input\"]", "可选输入框配置，包括 placeholder 和能力开关。"], ["workspace", "AgentsChatWorkspaceOptions", "工作区布局与打开策略。"]], note: providerHint},
  {slug: "goal", title: "目标", symbol: "AgentGoalBar", item: "agent-goal", path: "ai/agents/agent-goal-bar", description: "显示目标进度，并提供编辑、暂停、恢复和清除入口。", props: [["controller", "AgentGoalController", "必填，由 useAgentGoal 创建，持有目标与控制方法。"]], note: "创建目标通过 goalMode 消息完成。写操作携带 goalId 和 goalRevision；409/410 刷新状态并保留草稿，不自动重放写入。"},
  {slug: "messages", title: "消息", symbol: "AgentsChatMessage", item: "agent-messages", path: "ai/agents/agents-chat-message", description: "展示流式消息、工具调用、引用与历史记录。", props: [["chatList", "ChatItem[]", "必填，已归并的消息列表。"], ["conversationId", "string", "当前会话标识。"], ["onLoadOlderMessages", "() => void", "加载更早历史，配合 hasOlderMessages 使用。"], ["onPlanApproval", "(params) => void", "计划审批回调，参数包含 messageId、approved、feedback。"]], note: "预览使用只读历史组合，展示真实消息组件。独立接入时传入聊天状态层产生的 ChatItem[]；交互审批需提供相应回调。"},
  {slug: "composer", title: "输入框", symbol: "AgentsChatInput", item: "agent-composer", path: "ai/agents/agents-chat-input", description: "多行输入、附件和模型选择，共用统一消息提交回调。", props: [["onSubmit", "AgentsChatInputSubmit", "必填，接收 query、config 和可选 callback。"], ["placeholder", "string", "输入占位文案。"], ["submissionBlocked", "boolean", "阻止提交，保留能力配置入口。"], ["isResponding", "boolean", "控制生成状态，配合 onStop 使用。"], ["showAttachments", "boolean", "控制附件入口，默认显示。"]], note: "预览在聊天上下文中展示输入框，可发送消息验证流式反馈。独立使用时需提供提交回调和所需的聊天配置上下文。"},
  {slug: "conversations", title: "会话", symbol: "ConversationList", item: "agent-conversations", path: "ai/agents/conversation-list", description: "管理会话选择、新建、分组和历史记录。", props: [["activeConversationId", "string", "当前选中会话。"], ["onConversationSelect", "(id: string) => void", "必填，选择会话的回调。"], ["onNewConversation", "(groupId?: number) => void", "必填，开始新会话。"], ["refreshSignal", "number", "变化时刷新列表。"], ["showNewConversationButton", "boolean", "是否显示内置新建按钮。"]], note: "预览使用真实会话列表与模拟客户端；移动端完整工作台隐藏桌面侧栏，此页独立预览仍可操作列表。"},
  {slug: "workspace", title: "工作区", symbol: "AgentChatWorkbench", item: "agent-chat-workbench", path: "blocks/agent-chat-workbench", description: "将会话、聊天和制品预览组合成完整 Agent 工作台。", props: [["initialConversationId", "string", "初始会话 ID。"], ["readOnly", "boolean", "只读模式，默认 false。"], ["className", "string", "容器布局类名。"]], note: "工作台自动启用文件预览和 SQL 图表。点击聊天输入框菜单中的工作区入口查看制品；仅需基础聊天时安装 agent-chat。"},
];
export const componentDocs: ComponentDoc[] = definitions.map(def => {
  const common = `"use client";\nimport {${def.symbol}} from "@/components/xlt-agent/${def.path}";\n`;
  const examples: Record<string, string> = {
    chat: '\nexport function ChatExample() {\n  return <AgentChat input={{placeholder: "有什么可以帮你？"}} />;\n}',
    goal: 'import {useAiChatContext} from "@/components/xlt-agent/ai/agents/context";\nimport {useAiChatAccess} from "@/components/xlt-agent/ai/agents/use-ai-chat-access";\nimport {useAgentGoal} from "@/components/xlt-agent/ai/hooks/use-chat/use-agent-goal";\n\n// 在已确认渠道支持目标模式后渲染，外层需要 AgentProvider。\nexport function GoalExample({conversationId}: {conversationId: string}) {\n  const {httpClient} = useAiChatContext();\n  const access = useAiChatAccess();\n  const controller = useAgentGoal({\n    httpClient, conversationId, enabled: access.canRead,\n    executionActive: false,\n    requireAccess: () => access.requireAccess("execute"),\n  });\n  return <AgentGoalBar controller={controller} />;\n}',
    messages: 'import type {ComponentProps} from "react";\n\nexport function MessagesExample(props: ComponentProps<typeof AgentsChatMessage>) {\n  return <AgentsChatMessage {...props} />;\n}\n// chatList 为聊天状态层产生的 ChatItem[]。',
    composer: 'import type {ComponentProps} from "react";\n\nexport function ComposerExample({onSubmit}: Pick<ComponentProps<typeof AgentsChatInput>, "onSubmit">) {\n  return <AgentsChatInput onSubmit={onSubmit} placeholder="输入你的问题…" />;\n}',
    conversations: 'import {useState} from "react";\n\nexport function ConversationsExample() {\n  const [conversationId, setConversationId] = useState<string>();\n  return <ConversationList\n    activeConversationId={conversationId}\n    onConversationSelect={setConversationId}\n    onNewConversation={() => setConversationId(undefined)}\n  />;\n}',
    workspace: '\nexport function WorkspaceExample() {\n  return <div className="h-screen min-h-0">\n    <AgentChatWorkbench />\n  </div>;\n}',
  };
  const code = common + examples[def.slug];
  const chapterText = [def.description, registryCommand(def.item), `${def.note}\n${code}`, def.props.map(prop => prop.join(" ")).join("\n"), "快速开始 令牌与服务端接入 源码安装与条目"];
  return {...def, props: def.props as [string, string, string][], href: `/components/${def.slug}`, group: "核心组件", chapters: ["交互预览", "安装", "使用", "主要参数", "相关文档"].map((title, index) => ({id: `section-${index + 1}`, title, blocks: [{kind: "text" as const, value: chapterText[index]!}]})), code};
});
export const introduction: PageEntry = {href: "/docs", title: "介绍", description: "可安装、可修改、可组合的 Agent 界面源码。", group: "开始使用", chapters: [
  {id: "source", title: "你的界面，你的源码", blocks: [{kind: "text", value: "XLT Agent UI 通过 shadcn Registry 分发 React 19 与 Tailwind 4 组件源码。安装后，组件直接进入你的项目，你可以按自己的产品需求调整布局、样式和组合。"}]},
  {id: "start", title: "从这里开始", blocks: [{kind: "text", value: "先阅读快速开始，准备客户端、服务端令牌接口和样式。需要完整体验时使用聊天或工作台；已有界面可分别安装消息、输入框、会话与目标组件。"}]},
  {id: "boundary", title: "清晰的集成边界", blocks: [{kind: "text", value: "SDK 负责 OpenAPI 与传输，Provider 管理身份和状态，组件负责交互。AK/SK 和 HMAC 签名始终留在服务端；浏览器每次请求获取新的单次使用令牌。"}]},
]};
export const navigation = [introduction, ...guides.filter(page => page.group === "开始使用").sort((a, b) => a.href === "/docs/quick-start" ? -1 : b.href === "/docs/quick-start" ? 1 : 0), ...componentDocs, ...guides.filter(page => page.group !== "开始使用")];
export const groups = ["开始使用", "核心组件", "接入指南", "维护与升级"];
export const searchIndex = [...navigation, {href: "/components", title: "组件目录", description: "按需选择源码条目", group: "核心组件", chapters: []}, {href: "/examples", title: "交互演示", description: "聊天、工作台、历史与目标模式", group: "示例", chapters: []}].flatMap(page => [
  {href: page.href, title: page.title, group: page.group, text: page.description},
  ...page.chapters.map(chapter => ({href: `${page.href}#${chapter.id}`, title: `${page.title} / ${chapter.title}`, group: page.group, text: chapter.blocks.map(block => block.value).join(" ")})),
]);
export function searchPages(query: string, index = searchIndex) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return index.filter(item => !item.href.includes("#")).slice(0, 8);
  return index.filter(item => terms.every(term => `${item.title} ${item.text}`.toLowerCase().includes(term)))
    .sort((a, b) => Number(b.title.toLowerCase().includes(query.toLowerCase())) - Number(a.title.toLowerCase().includes(query.toLowerCase()))).slice(0, 12);
}
