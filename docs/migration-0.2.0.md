# 0.2.0 SDK 接入升级说明

本地候选版本使用 @lingya-ai/agents-sdk 0.7.0 / 契约 0.1.7，未远程部署或发布。0.1.0 快照保留不覆盖。

## 接入变化

浏览器直接实例化 @lingya-ai/agents-sdk/browser 的 AgentsClient，传入 baseUrl（服务来源或网关前缀）、channelId、auth.tokenProvider 和可选 fetch/webSocketFactory。Provider 原样使用该客户端，不克隆、不继承重写传输、不增加 DTO 或错误转换层。

删除 UI 自建 HTTP 客户端、操作路由分发、响应 Schema、SSE/WS 解析、HMAC 签名与请求重试实现。协议类型来自 SDK；本地 Schema 仅校验表单输入。useOpenApiOperation 接收 SDK 方法回调，仅负责 React 请求状态。服务端令牌 Handler 调用 Node SDK 的 configuration.createOpenApiToken；外部身份取自宿主服务端认证。

令牌为一次性，每个 HTTP 请求和流连接独立调用 tokenProvider，不能缓存或合并令牌值。SDK 不自动重放写操作；UI 断流恢复仅重新订阅已有 conversationId/messageId。

## 类型与展示边界

日期保持 SDK Date；列表使用 records/page，批量事件使用 records/skipped，错误直接读取 ApiError.kind/status/code/fields/requestId。公开业务事件不提供 sequence，展示保留接口顺序；流探针仍有其专用 sequence。

工作区文件通过 relativePath 标识和预览，不再虚构 fileId。消息制品保留后端提供的版本 ID，同路径工作区预览与历史消息版本使用独立标签。置顶属于宿主本地能力，通过 isConversationPinned/onTogglePinned 注入；后端仍负责授权。HTML 制品没有公开的编辑模式字段，组件不据此推断编辑权限。

身份或客户端变化时 Provider 重建作用域，取消旧请求、断开旧流、清理对应缓存；同一 SDK 实例也不会跨 identityKey 复用缓存或在途查询。StrictMode 的模拟卸载不会提前中止新作用域。

## 安装与一起升级的文件

升级时一起审查 agent-client、agent-server、agent-session 与使用的展示条目；不要只覆盖消息组件。Registry 版本路径为 /r/0.2.0/，SDK 固定 0.7.0。SDK 类型、协议状态文件和展示组件须保持同批版本。

截至 2026-10-21，npm 尚无 SDK 0.7.0。当前 pnpm override 指向本地 .cache/sdk/lingya-ai-agents-sdk-0.7.0.tgz，独立安装验证也显式使用本地包。Registry 不包含本机路径。公开使用前必须发布或取得可访问的 SDK 包；本地验证不证明 npm 安装已可用。

本地复现时先在相邻 openapi-sdk/lingya-agents-sdk-typescript 执行 npm run build，再执行 npm pack --pack-destination 指向本项目 .cache/sdk 的绝对路径，随后在本项目执行 pnpm install。SDK 包摘要记录在 provenance/sdk.json，不能静默替换同版本包。

## 已知 SDK 边界与验证

当前已复现：流事件日期声明为 Date 但解码为字符串、InstantChartColumn 时间数组未解码 Date、事件嵌套未知工具扩展与独立解码的 rawJson 形态不一致。应在契约生成源修复，UI 不添加协议转换层；日期展示容错仅负责格式化。

验证结果以 verification.md 和本次生成的 artifacts 为准。真实渠道联调仍缺少凭据；模拟与本地 HTTP 服务测试不能替代真实渠道验收。
