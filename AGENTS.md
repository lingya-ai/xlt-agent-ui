# Repository Guidelines

## 项目结构与模块组织

本项目是 pnpm 工作区，通过 shadcn Registry 分发 React 19 与 Tailwind 4 组件源码。

- `packages/registry/src/`：共享实现，包括 AI Hooks、UI 组件、OpenAPI 集成、样式和示例。可复用功能统一在此修改，两个应用直接复用这些源码。
- `apps/docs/`：基于 Next.js 的中文文档站和演示。
- `apps/vite-example/`：独立的 Vite 接入示例。
- `tests/`：集成测试与公共初始化配置；单元测试也放在对应源码旁。
- `scripts/`：Registry 构建、契约检查、安装验证和浏览器检查脚本。
- `docs/`、`provenance/`：接入契约、迁移说明、来源与许可证记录。`artifacts/` 保存本地验证报告和截图。

## 构建、测试与本地开发

使用 Node.js 22+ 和 pnpm 10.30.2。执行 `pnpm install` 前，按照 `docs/migration-0.2.0.md` 准备本地 SDK 压缩包。

- `pnpm dev`：启动文档站，端口为 4600。
- `pnpm --filter @xlt/vite-example dev`：启动 Vite 示例，端口为 4601。
- `pnpm registry:build` / `pnpm registry:serve`：生成 Registry 资源 / 在 4602 端口提供服务。
- `pnpm check`、`pnpm lint`、`pnpm contracts:check`：分别检查 TypeScript 类型、ESLint 配置范围内的代码和 API 契约。
- `pnpm test`：运行一次 Vitest 测试。
- `pnpm build:docs` / `pnpm build:vite`：分别构建文档站和 Vite 示例。
- `pnpm verify:install`：验证真实 shadcn 安装流程，需先启动 Registry 服务。
- `pnpm check:browser`：检查现代 Chrome 和 Chromium 102，需启动文档站并准备浏览器可执行文件。

## 代码风格与命名规范

使用 TypeScript、React 函数组件和两空格缩进。引号、空格及分号风格与相邻代码保持一致；当前未配置格式化工具。文件名使用 kebab-case，组件名使用 PascalCase，函数名使用 camelCase，Hook 文件使用 `use-*` 命名。ESLint 采用 typescript-eslint 推荐规则；有意保留的未使用参数以 `_` 开头。可复用样式放入 Registry 源码。

## 测试规范

Vitest 使用 jsdom 环境和 `tests/setup.ts`，组件测试使用 React Testing Library。测试文件命名为 `*.test.ts` 或 `*.test.tsx`。可通过 `pnpm test -- tests/upload.test.tsx` 运行指定测试。行为变更应补充回归测试；当前未设置数值覆盖率门槛。提交前运行相关检查和消费端应用构建。

## 提交与 Pull Request 规范

当前分支尚无提交记录，因此没有可归纳的历史提交格式。建议使用简洁、说明动作的标题，可添加作用域，例如 `fix(chat): 修复流式恢复`。PR 应说明行为变化、关联相关 Issue、列出验证结果；涉及可见 UI 变化时附上截图。接入行为变化时同步更新迁移或契约文档。

## 安全与配置

HMAC 签名和凭据仅在服务端处理。浏览器令牌提供函数每次必须获取新的单次使用令牌。已发布的 Registry 快照不可覆盖，发布变更时必须递增版本号。
