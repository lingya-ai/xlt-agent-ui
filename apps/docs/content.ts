export const sections = [
  {slug:"quick-start",title:"快速开始",body:`
先在 React 19 + Tailwind 4 的宿主项目中初始化 shadcn，确认 components.json 的 aliases 与 CSS 入口正确。

本地构建 Registry 后启动服务，再在你的项目目录执行：

\`\`\`sh
pnpm dlx shadcn@4.22.1 add http://localhost:4602/r/0.2.0/agent-chat.json
\`\`\`

客户端与类型直接从 @lingya-ai/agents-sdk/browser 导入；Provider 和组件从安装后的源码叶子路径导入。下例的 components 路径由宿主 components.json 决定。

\`\`\`tsx
"use client";
import {useMemo} from "react";
import {AgentsClient, OpenApiTokenFromJSON} from "@lingya-ai/agents-sdk/browser";
import {AgentProvider} from "@/components/xlt-agent/openapi/provider";
import {AgentChat} from "@/components/xlt-agent/blocks/agent-chat";

export function Chat({userId}: {userId: string}) {
  const client = useMemo(() => new AgentsClient({
    baseUrl: "https://api.example.com",
    channelId: "CHANNEL",
    auth: {type: "token", tokenProvider: async ({signal}) => {
      const response = await fetch("/api/agent-token", {method: "POST", signal, cache: "no-store"});
      if (!response.ok) throw new Error("令牌获取失败");
      return OpenApiTokenFromJSON(await response.json()).token;
    }},
  }), [userId]);
  return <div className="h-screen min-h-0">
    <AgentProvider client={client} identityKey={userId}>
      <AgentChat/>
    </AgentProvider>
  </div>;
}
\`\`\`

baseUrl 是部署 API 的来源地址或网关前缀，channelId 单独指定；SDK 会构造 /api/agents/channel/openapi/v1/{channelId}/chat 路径，不传完整聊天地址。

在宿主 CSS 入口引入已安装的 styles/agent.css，并通过 @source 扫描安装目录。Provider 默认使用 SSE。身份与渠道共同组成 identityKey；切换时 Provider 会取消旧请求、卸载旧状态和关闭旧流。渠道地址或令牌函数变化时创建新的客户端。
`},
  {slug:"authentication",title:"令牌与服务端接入",body:`
浏览器只接收短期 token 与 expiresAt。服务端使用 AK/SK 对 POST /chat/presign 签名。外部 userId 必须来自接入方已认证会话，不能接受浏览器任意指定的用户标识。

单独安装 agent-server，放在服务端路由中。示例 authenticate 要替换为接入方真实认证函数。

\`\`\`ts
import {createAgentTokenHandler} from "@/components/xlt-agent/openapi/presign.server";
import {getAuthenticatedUser} from "@/lib/session";

export const POST = createAgentTokenHandler({
  baseUrl: process.env.AGENT_API_URL!,
  channelId: process.env.AGENT_CHANNEL_ID!,
  auth: {
    type: "hmac",
    accessKey: process.env.AGENT_ACCESS_KEY!,
    secretKey: process.env.AGENT_SECRET!,
  },
  authenticate: getAuthenticatedUser,
});
\`\`\`

签名使用原始路径、查询串、UTF-8 用户标识的 base64url、随机 nonce、秒时间戳及空请求体的 SHA-256。请求头为 X-OpenAPI-AK / Timestamp / Nonce / User / Signature；不使用 Bearer 认证。

客户端通过 X-OpenAPI-Token 发送短期令牌，WebSocket 通过 xlt-openapi-token.<token> 子协议发送。令牌不放入 URL，也不持久化到 localStorage。当前后端令牌十分钟内有效且只能消费一次。每次 HTTP 请求、SSE 重新订阅和 WebSocket 握手均调用 tokenProvider 签发新令牌，接入方不得缓存令牌或合并并发请求的令牌值。401 不自动重放可能已经被后端接受的写请求。

WebSocket 显式配置 AgentProvider options={{streamTransport: "ws"}}。默认 SSE 的重连只订阅同一个 messageId，不重新发送用户输入。订阅流与写操作的重试边界必须保留。

跨域接入时，接入方需允许后端实际使用的 X-OpenAPI-* 请求头及 WebSocket 子协议。服务端时钟需要同步。短期令牌接口应使用 no-store，并遵循接入方现有的会话认证与 CSRF 策略。
`},
  {slug:"installation",title:"源码安装与条目",body:`
Registry 源码是唯一实现，文档站直接复用。分发文件只是归集源码、转换安装路径，不生成另一套业务逻辑。普通 shadcn separator 与 skeleton 通过 registryDependencies 安装；带内部交互或兼容改造的 UI 单独移植。

agent-client 直接导出 SDK 的客户端、类型和错误，不再维护另一套响应 Schema 或请求封装；agent-server 使用服务端 SDK 完成签名；agent-session 提供 Provider、状态层与通用接口 Hook。

agent-messages、agent-composer、agent-conversations、agent-interactions、agent-goal、agent-async-tasks、agent-subagents、agent-workspace、agent-files、agent-citations 和 agent-sql 可独立安装。

基础 agent-chat 不安装 PDF、Office、ECharts。安装 agent-files 后，用 integration/file-previews 中的 AgentFilePreviewsProvider 包裹聊天，启用文件预览；安装 agent-sql 后，用 integration/sql-charts 中的 AgentSqlChartsProvider 启用 SQL 图表。两个 Provider 可嵌套。未启用时仍可下载文件和查看 SQL 数据表。完整工作台从 blocks/agent-chat-workbench 导入 AgentChatWorkbench，自动启用两项能力。

agent-chat 为完整聊天组合；agent-chat-workbench 包含会话目录与工作区；agent-history 提供只读消息与事件回放。agent-demo 为可运行的本地模拟示例；agent-goal-demo 提供独立目标演示。

\`\`\`sh
pnpm dlx shadcn@4.22.1 add http://localhost:4602/r/0.2.0/agent-chat-workbench.json
\`\`\`

条目使用完整依赖闭包，相同文件在多个条目中内容一致，路径统一落在 @components/xlt-agent。CLI 根据宿主 components.json 解析目录与 alias。升级覆盖前请审查本地修改。

文件预览、SQL 图表会分别引入对应依赖；仅协议客户端不会引入预览器。完整聊天包含工具富结果能力，因此依赖比单独的客户端和输入框多。请用独立条目控制自己的依赖范围。
`},
  {slug:"goal",title:"目标模式与控制",body:`
目标模式覆盖创建、当前目标、历史分页、编辑、暂停、恢复和清除。安装 agent-goal 获取目标组件与 Hook；agent-goal-demo 提供目标演示及内存模拟客户端。下方演示仅使用本地模拟数据。

目标没有单独的创建接口。向 POST /chat 或 POST /chat/conversations/{conversationId} 发送 query 与 goalMode: true 创建目标，不能同时启用 planMode。渠道配置 goal.supported 决定入口是否可用。

查询使用 GET /conversations/{conversationId}/goal 与 GET /conversations/{conversationId}/goal/history?page=0&size=20。编辑使用 PATCH /conversations/{conversationId}/goal；暂停、恢复、清除分别使用 POST /goal/pause、/goal/resume、/goal/clear（均位于同一会话路径下）。

所有目标写操作携带 goalId、goalRevision，编辑额外携带 objective。409 表示版本冲突，410 表示目标被替换；useAgentGoal 刷新状态，保留编辑草稿，由用户决定后续操作，不自动重放写请求。

AgentGoalBar 提供紧凑状态与快捷操作；AgentGoalDetails 提供编辑、控制和历史；AgentGoalDemo 组合上下文中的客户端与上述组件。清除后当前目标为空，历史保留 CLEARED 墓碑，可创建新目标。历史默认每页 20 条，最大 100 条。

本地模拟以标准 JSON 响应及事件驱动 SDK 客户端与 Hook，记录会话独立的目标、修订版本和历史；它不执行真实 Agent 任务。真实渠道联调仍需要接入方凭据，模拟成功不代表已完成真实联调。
`},
  {slug:"components",title:"组件与契约",body:`
AgentProvider 注入 client、identityKey、locale、messages 和 options。AgentChat 接受当前 conversationId、readOnly、input、workspace、emptyState 与消息展示选项。AgentChatWorkbench 负责会话目录与聊天组合。

独立组件沿用移植来源的公开 Props，包括 AgentsChatMessage、ConversationList、PlanApprovalBlock、AgentGoalBar、WorkspaceController、SqlQueryResult 等。具体类型与依赖位于安装后的同名叶子文件中。

用户交互由组件和专门 Hook 覆盖；统计、同步、查询直接调用 SDK，useOpenApiOperation 仅负责 React 请求状态。

\`\`\`ts
const page = await client.conversations.listConversations({current: 0, size: 30});
const goal = await client.chat.getGoal("conversation-id");
\`\`\`

HTTP 返回类型与解码由 SDK 提供，UI 不添加响应转换层。列表使用 records，分页使用 page.current / size / total，页码从 0 开始。无返回值的控制操作允许空响应；错误直接使用 SDK ApiError，读取 kind、status、code、fields 和 requestId。

目标通过发送消息的目标模式创建；暂停、恢复、编辑和清除使用带版本的控制接口。旧版本冲突刷新权威状态，保留用户输入且不自动重试写入。授权始终由后端执行，前端 accessPolicies 只控制交互入口。

下方覆盖表从后端 Controller 快照生成。SSE、WebSocket 和探针由 SDK 管理传输生命周期，UI 负责显示归并与恢复策略，下载使用 SDK 元数据接口，presign 只在服务端调用。渠道管理、发布和 AK/SK 管理不属于聊天 Registry。
`},
  {slug:"theme",title:"主题与兼容性",body:`
组件使用宿主 shadcn 语义令牌：background、foreground、primary、primary-foreground、muted、muted-foreground、accent、border、input、ring、popover、destructive。附带 agent.css 仅提供移植组件的别名，不携带 Studio 品牌字体或全局主题。

\`\`\`css
@import "tailwindcss";
@import "./components/xlt-agent/styles/agent.css";
@source "./components/xlt-agent";
@custom-variant dark (&:where(.dark, .dark *));
\`\`\`

宿主仍需使用 shadcn 初始化生成的 @theme 映射。提供的 Next.js 与 Vite 应用演示完整配置。长消息列表需要明确的高度链：外层固定或 h-full，Flex 子层 min-h-0，滚动区 flex-1。

Chromium 102 不支持 :has、容器查询、field-sizing、动态视口单位、oklch 和 color-mix。移植组件使用显式布局、textarea 自动伸高与 focus-within 焦点降级。Tailwind 4 本身面向较新浏览器，附带 postcss-chromium102.cjs 用于生成 @property 初始值和语义混色降级。宿主需要启用同一后处理，或提供自己经过验证的兼容管线。

为 Chromium 102 配置主题时使用十六进制或 rgb/hsl，不要仅提供 oklch 变量。混色降级保留基础语义色，旧浏览器的透明度可能与现代浏览器略有不同。不能将最新版 Chrome 的测试结论当作 Chromium 102 验收。
`},
  {slug:"i18n",title:"中英文与文案",body:`
AgentProvider 默认中文。locale 使用 AgentLocale.Zh / AgentLocale.En。messages 支持按 dictionary key 的带类型局部覆盖，并继承未覆盖的默认文本。

\`\`\`tsx
import {AgentLocale} from "@/components/xlt-agent/i18n/runtime";
<AgentProvider client={client} identityKey={identityKey}
  locale={AgentLocale.En} messages={{
    "agents-chat": {startConversation: "Restoring conversation"},
  }}>
  <AgentChat/>
</AgentProvider>
\`\`\`

移植后的 useAgentMessages 返回可直接渲染的文本节点，并以 .value 读取纯字符串。插值条目保留参数签名；覆盖内容使用 {{parameter}} 占位符。无需安装 Intlayer 或注入私有租户空间 Provider。
`},
  {slug:"versions",title:"版本与升级",body:`
当前本地候选版本 0.2.0，使用 SDK 0.7.0 / 契约 0.1.7。SDK 0.7.0 尚未发布 npm，本地验证显式覆盖为 SDK tarball；公开接入前需确认该版本已可安装。后端来源与前端移植来源记录在 provenance/source.json，包含提交和源文件 SHA-256。原仓库已有未提交改动也记录在该文件中；快照同时保留文件哈希，不能只依赖提交号重建。

发布地址使用 /r/<version>/<item>.json。发布后不得覆盖同版本内容。构建器校验已有快照，文件变化时要求版本递增；REGISTRY_DEV=1 仅用于尚未发布的本地候选版本重建。

相同版本内所有条目使用同一份源码闭包，不依赖可漂移的内部 latest 条目。checksums.json 记录每个条目的 SHA-256，第三方基础 UI 由 shadcn 官方 Registry 提供。

展示组件位于 ai/agents、ai/components、ui、file-preview 和 charts；协议与状态文件位于 openapi、api、ai/hooks/use-chat、ai/lib 与 i18n。升级时同一版本涉及的协议、Schema、状态与展示条目必须一起审查，不能只覆盖消息组件。

先检查迁移说明与后端兼容性，再对比本地源码修改、安装新条目、执行类型与应用构建、用真实渠道验证关键操作。新项目独立维护，不建立自动同步，也不会反向修改内部 packages/ai。

本次不执行远程发布。真实渠道验收和源码许可确认属于公开发布前的检查项；没有凭据时只能记录未完成，不能用模拟测试代替。
`},
  {slug:"maintenance",title:"来源、许可与维护",body:`
provenance/source.json 保存迁移来源、提交与源文件哈希；provenance/contracts.json 保存每个后端路由的位置；provenance/backend 保存用于契约核对的 Controller 快照。

第三方依赖和许可证清单通过 pnpm licenses list 生成，归属说明见 THIRD_PARTY_NOTICES.md。shadcn/ui 与 AI Elements 来源的注释和作者信息在源码中保留。依赖的许可证不自动授予上游业务源码的开源权利。

原业务仓库未发现明确的开源许可证，项目保持 private，源码授权标记为待权利人确认。对外发布前需由权利人确认业务源码和后端契约快照的分发许可，并检查依赖归属与许可证要求。本地构建、移植与验证不等同于已经完成公开授权。

维护命令：pnpm contracts:check、pnpm test、pnpm check、pnpm registry:build、pnpm verify:install、pnpm build:docs、pnpm build:vite 与 pnpm check:browser。验证报告位于 artifacts；开发时使用 pnpm dev 与 pnpm --filter @xlt/vite-example dev。
`},
] as const;
