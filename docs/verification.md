# 本地验收记录

验收日期：2026-10-21。版本：0.2.0 本地候选；未远程部署或发布。SDK 为 @lingya-ai/agents-sdk 0.7.0，契约为 0.1.7。

## SDK 迁移

UI 直接使用 SDK 客户端、协议类型、ApiError 和 chat.subscribeChatEvents。Provider 保留传入的客户端实例；没有新增 HTTP、DTO、错误或流协议转换层。原自建 HTTP/SSE/WebSocket、路由调用分发、响应 Schema 和签名实现已删除。UI 仅保留请求状态、缓存、重连、历史恢复、消息归并、交互与渲染；服务端令牌示例直接调用 Node SDK。

| 范围 | 当前结果与证据 |
| --- | --- |
| 契约盘点 | pnpm contracts:check 通过；64 个 SDK HTTP 方法和 1 个 WebSocket 入口与后端快照关联，见 contracts.md |
| 类型和静态检查 | pnpm check、pnpm lint 通过；packages/registry/src/ai 另行 ESLint 通过；320 个公开叶子 export 对应文件均存在 |
| 单元和组件测试 | 最终源码 85 个测试文件、621 项全量通过，见 .cache-sdk-tests-final.log；包括新增的目标创建身份切换回归，定向测试记录见 .cache-sdk-signal-tests.log；旧自建协议层测试已改为 SDK 请求、订阅和 UI 状态验证 |
| 生命周期与状态 | 覆盖独立一次性令牌、SDK 错误、取消、身份切换、同一 SDK 实例下的缓存隔离、StrictMode、断流恢复、401 终止、发送和审批不自动重放、历史同步、排队和上传中止 |
| 业务交互 | 审批、用户回答、目标、子任务、附件去重、引用及工作区的单元和组件测试；不等同真实服务验收 |
| Registry | 22 个 0.2.0 条目；shadcn Schema、依赖闭包、固定版本关联、路径转换和轻量入口依赖限制通过；重复生成内容一致，0.1.0 快照未覆盖 |
| 独立安装 | shadcn CLI 在全新版本目录安装 Next.js 与 Vite；分别使用 @、~ 和自定义组件目录；类型和生产构建通过，见 artifacts/install-next.json、install-vite.json |
| 本地文档及示例 | pnpm build:docs、pnpm build:vite 通过；文档与演示复用 Registry 唯一实现 |
| 文档生产站浏览器 | Chrome 155.0.8059.84 和 Chromium 102.0.5005.40 通过，见 artifacts/browser-docs.json |
| 安装后 Vite 浏览器 | 上述两种内核通过，见 artifacts/browser-vite.json |
| 安装后 Next.js 浏览器 | 上述两种内核通过，见 artifacts/browser-next.json |
| 目标浏览器交互 | 上述两种内核通过创建、编辑、暂停、恢复、清除、保留历史、重新创建、中英文、深色、390px 和键盘操作，见 artifacts/browser-goal.json |

通用浏览器脚本覆盖首次加载、hydration、SDK SSE 发送、连续 12 轮对话、历史只读、工作台、工作区 Markdown 预览、Escape 关闭、主题、语言、390px 窄屏、长输入自动伸高及键盘焦点；捕获页面异常和控制台错误。没有据此声称所有文件格式和所有工具的视觉状态均已检查。完整 Vite 示例仍有大 chunk 提示，重型预览与图表在独立条目中按需引入。

SDK 自身 npm run check 通过：23 项测试通过、1 项真实联调跳过；打包、公共模型审计与浏览器冒烟通过。npm run browser:102 在真实 Chromium 102.0.5005.40 验证 HTTP/CORS/SSE/WebSocket、取消、超时、下载与诊断通过。

## 包来源与已知 SDK 问题

npm 尚无 SDK 0.7.0。项目使用本地 tarball override；独立安装脚本创建隔离的本地 npm fixture，仅提供该 SDK tarball，其他依赖照常安装。Registry 依赖仍为标准 @lingya-ai/agents-sdk@0.7.0，没有写入本机路径。此验收不证明 SDK 已可从公共 npm 安装；来源摘要见 provenance/sdk.json。

仍复现三个 SDK 解码一致性问题：等待用户输入事件的 serverNow 声明 Date、订阅实际给出字符串；InstantChartColumn.values 没有将时间字符串转为 Date；事件内未知工具扩展未形成独立解码器约定的 rawJson 回退。修复应进入 SDK 的契约生成源，UI 没有增加协议转换层；日期显示容错仅用于格式化。

## 来源只读核对

pnpm exec tsx scripts/check-sources.ts 只读比较来源，报告见 artifacts/sources.json。461 个前端来源文件、4 个后端 Controller 快照及认证实现快照均无内容变化。原前后端完整 Git 状态均与初始快照不同，检查退出码为 2，不能记为通过；未清理或回退这些并行改动。本次迁移的源码、依赖、配置及文档写入仅发生在 xlt-agent-ui，SDK 仅执行自身构建和检查。

## 尚未完成的外部验收

没有测试渠道凭据，真实令牌、跨域、WebSocket 代理、实际文件存储、审批执行和 SQL 导出仍未联调；模拟测试不能替代这些结果。演示默认模拟，真实渠道需显式配置。没有远程部署或发布。

本项目采用 MIT 许可证，见 LICENSE。包元数据保留 private 以防止意外发布到 npm。第三方归属见 THIRD_PARTY_NOTICES.md、licenses/ 和 provenance/licenses.json；第三方代码仍遵循其原有许可，聚合许可清单不代表已经完成所有第三方归属核对。

## 复验

按 migration-0.2.0.md 准备本地 SDK 包，执行 pnpm install --frozen-lockfile、pnpm check、pnpm lint、pnpm test、pnpm registry:build。启动 pnpm registry:serve 后执行 pnpm verify:install。文档或安装宿主生产站启动后，以 BROWSER_TEST_URL 指定地址运行 pnpm check:browser；目标文档运行 pnpm exec tsx scripts/check-goal-browser.ts。Chromium 102 默认取本项目 .cache/browsers，也可通过 CHROMIUM102_PATH 指定。报告与截图保存在 artifacts/，不进入 Registry 源码分发。

0.1.0 迁移前的 649 项测试属于历史结果；当前验收以本页和 0.2.0 产物为准。
