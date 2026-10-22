# XLT Agent UI

[在线文档](https://lingya-ai.github.io/xlt-agent-ui/) · [组件目录](https://lingya-ai.github.io/xlt-agent-ui/components/) · [交互演示](https://lingya-ai.github.io/xlt-agent-ui/examples/)

## 一句话生成 Agent 项目

将下面这句话复制给你的 AI 编程助手（如 Codex、Cursor 或 Claude Code）。助手会读取接入指南，确认项目目录与连接参数后创建项目；无需先克隆本仓库。

> 请读取 https://raw.githubusercontent.com/lingya-ai/xlt-agent-ui/main/docs/create-agent-project-prompt.md ，将其中的执行提示词作为我交给你的任务：使用 XLT Agent UI 的公开 Registry 和官方 SDK，在我的工作区创建独立的 Next.js Agent 对话项目；先检查已有上下文并集中向我确认缺少的必要参数，密钥只从本地服务端环境变量读取，然后直接实施并完成真实对话验证。

面向小灵通 OpenAPI 渠道的独立 React 组件源码 Registry。采用 shadcn CLI 分发，安装后源码归接入项目维护。

文档站通过 GitHub Pages 部署，地址为 https://lingya-ai.github.io/xlt-agent-ui/。当前 Registry 版本为 `0.2.0`。本项目采用 [MIT 许可证](./LICENSE)；真实渠道联调需要测试地址与凭据，模拟演示不代表真实验收。

## 本地运行

需要 Node.js 22+ 与 pnpm 10.30.2。SDK 0.7.0 当前尚未发布 npm，本地使用 tarball override；先按 docs/migration-0.2.0.md 准备 SDK 包。

```sh
pnpm install
pnpm registry:build
pnpm registry:serve
```

另一个终端启动中文文档与演示：

```sh
pnpm dev
```

文档站默认 `http://localhost:4600`，Registry 为 `http://localhost:4602/r/0.2.0/registry.json`，Vite 示例通过 `pnpm --filter @xlt/vite-example dev` 在 4601 端口启动。

文档入口为 `/docs`，核心组件目录为 `/components`，完整交互演示为 `/examples`。站点支持本地全文搜索（Ctrl/Cmd K）、明暗主题与移动导航；品牌资源复制自小灵通前端，独立构建不依赖兄弟仓库。

在已初始化 shadcn 的 React 19 + Tailwind 4 宿主中安装：

```sh
pnpm dlx shadcn@4.22.1 add http://localhost:4602/r/0.2.0/agent-chat.json
```

完整组合为 `agent-chat-workbench.json`。协议、会话、消息、输入框、审批、目标、子任务、工作区、预览、引用、SQL 等独立条目见文档站安装页。条目使用完整源码依赖闭包，基础 UI 通过固定版本的 Registry 依赖引入。

## 接入与主题

直接使用 `@lingya-ai/agents-sdk/browser` 的 `AgentsClient`，传入 API 来源或网关前缀 `baseUrl`、`channelId`、异步 `auth.tokenProvider` 和可选 Fetch；SDK 负责构造渠道聊天路径。浏览器仅接收 `{token, expiresAt}`；当前后端令牌只能使用一次，`tokenProvider()` 每次必须签发新令牌，不能缓存或合并令牌值。默认 SSE，显式配置可使用 WebSocket。`agent-server` 提供仅服务端使用的 HMAC 签名及令牌 Handler。

`AgentProvider` 接收 `client`、`identityKey`、`locale` 与带类型的 `messages`。身份或渠道切换时更新 `identityKey`，渠道地址或令牌函数变化时更换客户端。Provider 自动释放旧作用域请求与缓存。

宿主引入安装后的 `styles/agent.css` 并使用 Tailwind `@source` 扫描源码。组件不携带品牌字体、Studio 主题或私有 Provider。Chromium 102 需要启用附带的 `styles/postcss-chromium102.cjs` 后处理并提供十六进制 / RGB / HSL 主题变量，配置示例见文档站。

## 项目结构

- `packages/registry/src`：唯一实现，文档与示例直接复用
- `apps/docs`：Next.js 中文文档与本地模拟演示
- `apps/vite-example`：独立 Vite 接入示例
- `scripts`：归集、路径转换、契约检查、源码安装及浏览器验证
- `provenance`：前后端来源提交、文件哈希、接口快照、依赖许可证
- `docs/contracts.md`：64 个 HTTP 操作与 WebSocket 的覆盖表
- `docs/migration-0.2.0.md`：SDK 迁移调整与升级边界
- `docs/verification.md`：本地验收结果、证据路径与待完成项
- `artifacts`：本地验证报告与截图，不进入源码分发

## 验证

```sh
pnpm contracts:check
pnpm check
pnpm lint
pnpm test
pnpm registry:build
pnpm verify:install
pnpm build:docs
pnpm build:vite
pnpm check:browser
pnpm check:docs-browser
```

`verify:install` 需要 Registry 服务已启动，会在 `.cache/consumers` 创建独立 Next.js、Vite 宿主，通过真正的 shadcn CLI 安装并验证类型和构建。两者使用不同 alias 与自定义组件目录。

`check:browser` 需要文档站已启动，默认 4600。通过 `BROWSER_TEST_URL` 指向其他演示应用，`CHROMIUM102_PATH` 指向真实 Chromium 102 可执行文件。脚本同时运行现代 Chrome 与 Chromium 102；缺少浏览器将失败，不会降级为通过。自动化驱动固定为 Playwright 1.50.1，以支持旧内核的定位与可见性检查。

`check:docs-browser` 验证文档搜索、主题持久化、复制、组件预览和移动导航，并输出桌面、平板、手机的明暗主题截图至 `artifacts/docs-redesign`。可设置 `DOCS_TEST_URL`；验证子路径静态部署时另设置 `DOCS_TEST_BASE_PATH`，结果写入 `artifacts/docs-prefixed`。

## GitHub Actions

`.github/workflows/ci.yml` 在推送、Pull Request 和手动触发时，从 npm 获取 `@lingya-ai/agents-sdk` 的 `latest` 版本，执行类型、Lint、API 契约、测试、Registry 及两个示例应用构建。实际 SDK 版本显示在日志和任务摘要中；不再执行锁定 SDK 版本的 CI，也不需要 SDK 压缩包下载地址变量。

CI 和 Pages 仅在 runner 内将 SDK 依赖及本地 override 替换为本次查询的最新版本，再安装依赖，不回写仓库依赖或锁文件。npm 包不可访问或最新 SDK 与代码、契约快照不兼容时，工作流会失败。本地开发及 `pnpm verify:install` 仍按迁移文档使用本地 SDK 包。

浏览器兼容性检查仍按上面的本地命令执行，需要额外提供真实 Chromium 102 环境。

### 文档部署到 GitHub Pages

在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。默认分支推送或在默认分支手动运行 `Deploy documentation to GitHub Pages` 后，工作流会构建 Registry、静态导出文档并部署。默认地址为 `https://lingya-ai.github.io/xlt-agent-ui/`，实际域名及子路径从 Pages 配置读取。

部署产物包含 `/r/<version>/` 下的 Registry，文档安装命令也会使用部署地址。页面保留模拟交互；真实渠道认证仍需要外部服务端令牌接口，GitHub Pages 不运行 Node.js 服务。

本地验证静态导出时，设置 `GITHUB_PAGES=true`、`PAGES_BASE_PATH=/xlt-agent-ui` 和 `REGISTRY_ORIGIN=https://lingya-ai.github.io/xlt-agent-ui`，再执行 `pnpm registry:build` 与 `pnpm build:docs`。本地已有未发布快照需重建时可设置 `REGISTRY_DEV=1`。

## 发布与维护

发布使用不可变 `/r/<version>/` 路径与 `checksums.json`。构建器拒绝覆盖不同内容的同版本快照。`REGISTRY_DEV=1` 只用于尚未发布候选版本的本地重建，公开发布后必须递增版本。

`REGISTRY_ORIGIN` 设置未来 Registry 的公开根地址；固定关联条目和基础 UI 快照都指向同一版本。npm 直接依赖从当前 lockfile 安装结果记录为确切版本。提交迁移说明并一起审查 SDK 版本、协议状态与展示组件。

本项目从指定前端版本一次性移植，独立维护，没有自动同步。内部前后端仓库未因本项目而修改。许可证与归属信息见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

目标系列：文档 `/docs/goal`，首页组合示例选择“目标模式”。`agent-goal` 提供目标组件与 Hook，`agent-goal-demo` 提供生命周期演示与内存模拟。创建目标通过聊天 `goalMode: true`，清除后保留历史；真实任务执行需由宿主项目完成渠道接入。
