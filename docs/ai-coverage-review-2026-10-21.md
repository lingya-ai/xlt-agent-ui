# AI 组件覆盖复核

日期：2026-10-21。对比来源为 ../xiaolingtong-fe/packages/ai/src 当前工作树，目标为 packages/registry/src/ai 和本地 0.2.0 Registry 产物。仅审计，未修改业务实现或来源仓库。

## 结论

尚未完全覆盖。98 个 TSX 文件中同路径存在 79 个（80.6%），缺失 19 个；这是文件覆盖率，不是功能等价率。98 包含 citation-context.tsx 等上下文文件。

| 分类 | 来源 | 同路径存在 | 缺失 |
|---|---:|---:|---:|
| TSX 组件/上下文 |98|79|19|
| 其他实现与辅助 TS |119|106|13|
| 测试文件 |99|79|20|
| content 文案文件 |92|0|92|

文案已改为 i18n/messages.ts 和 runtime.tsx 集中管理，不能把 92 个原路径缺失直接视为翻译全部丢失。79 个已有 TSX 均出现在 22 个本地 Registry 条目的文件并集中；已核对这些 AI 文件快照与当前实现，归一化 import 路径和换行后无内容差异。该结果不代表每个组件都有独立安装条目。

## 缺失 TSX 清单

### 业务组件（7）

| 文件 | 缺少的直接复用能力 |
|---|---|
| agents/capability-option-row.tsx | 能力选择选项行 |
| agents/capability-selection-bar.tsx | 已选能力概览、编辑和移除 |
| agents/conversation-list-sheet.tsx | 会话列表抽屉封装，选中或新建后关闭 |
| agents/conversation-share-dialog.tsx | 会话分享对话框 |
| agents/skill-message-changes.tsx | 助手消息对应的 Skill 文件操作列表 |
| agents/sql-query-block.tsx | 折叠 SQL 语句、行号与复制 |
| agents/workspace-files-panel.tsx | 工作区触发按钮、数量和加载状态 |

其中会话列表、SQL 结果、工作区底层在目标存在，但不等于上述独立组件和 Props 契约已覆盖。

### 通用组件（12）

- components/chain-of-thought.tsx
- components/confirmation.tsx
- components/context.tsx
- components/database-tool-config.tsx
- components/image.tsx
- components/internal-tool-config-dialog.tsx
- components/internal-tools-section.tsx
- components/model-selector.tsx
- components/open-in-chat.tsx
- components/sources.tsx
- components/suggestion.tsx
- components/task.tsx

目标的 agent-model-selector、message-context-usage-ring、reasoning、knowledge-citation 等有相近业务用途，但不能据此判定原 model-selector、context、chain-of-thought、sources 的组合 API 完全等价。

## 已存在实现中的已确认差异

1. 停止生成：来源新增 use-chat-stop.ts 和 chat-control-policy.ts，区分 Requesting、AwaitingTerminal，合并重复请求、等待终态、超时及失败提示，并隔离迟到响应。目标 use-chat.ts 直接调用 SDK interruptConversation，失败静默，输入框没有 stopPending/stopState 与 aria-busy。停止功能存在，但交互状态并不等价。
2. 消息执行提示：来源通过 AgentsChat → 消息列表 → VirtualizedMessageList 传 isExecuting，在回到底部按钮展示执行动画。目标缺少该 Props 链和动画分支。
3. 消息事件展示：来源对 ChatClientRequest 和 ChatClientResponse 展示独立统计提示；目标没有这两个专用分支，对含 rawJson 的事件展示原始文本。
4. 权限：来源通过 @workspace/access 的资料、状态和策略计算权限；目标改成宿主传入 allowed/reason。属于接入契约变更，不能当作原 RBAC 完整迁移。
5. 会话置顶：来源读取 item.pinned；目标通过 isConversationPinned 回调获取，宿主需要提供状态。
6. 模型思考模式：来源从 config.modelConfig.defaultModel.thinking 获取默认值；目标增加 initialThinking，由最近会话配置提供。
7. 数据与传输：目标使用 @lingya-ai/agents-sdk/browser 的客户端、类型和事件，替代内部 HttpClient/Zod 协议与自建 WebSocket；agent-goal-api.ts、chat-websocket-stream.ts 等缺失不应机械判断成目标、WebSocket 功能完全缺失。
8. 国际化：next-intlayer/intlayer 改成 AgentMessagesProvider 与集中字典。原文件路径不兼容，本文未逐条证明所有来源文案键和值等价。

## 缺失辅助实现（13）

- agents/types.ts
- agents/use-resolved-model-makers.ts
- hooks/use-chat/agent-goal-api.ts
- hooks/use-chat/chat-control-policy.ts
- hooks/use-chat/chat-websocket-stream.ts
- hooks/use-chat/use-chat-stop.ts
- hooks/use-chat/use-conversation-shares.ts
- lib/conversation-share-route.ts
- lib/conversation-share-server-name-crypto.ts
- lib/internal-tool-config-types.ts
- lib/internal-tool-defaults.ts
- lib/internal-tool-schema.ts
- lib/remark-knowledge-citation.ts

分享的 UI、Hook、路由和加密辅助实现均没有同路径版本；内部工具配置的 UI、类型、默认值和 Schema 同样缺失。SDK 替代项与业务缺口需要分别处理。

## 来源基线已过期

provenance/source.json 记录的 329 个 AI 文件中，当前有 20 个摘要不同；当前来源另有 79 个文件未记录于该基线。未记录不能单凭此断言为近期新增：也可能是最初迁移入口闭包未纳入。docs/verification.md 的“来源均无内容变化”是历史结果，不能代表本次复核。

摘要不同的文件：

- packages/ai/src/agents/agent-goal-bar.test.ts
- packages/ai/src/agents/agent-goal-bar.tsx
- packages/ai/src/agents/agent-goal-form.content.ts
- packages/ai/src/agents/agent-goal-form.tsx
- packages/ai/src/agents/agent-goal-toggle.content.ts
- packages/ai/src/agents/agent-goal-toggle.tsx
- packages/ai/src/agents/agents-chat-input.content.ts
- packages/ai/src/agents/agents-chat-input.test.ts
- packages/ai/src/agents/agents-chat-input.tsx
- packages/ai/src/agents/agents-chat-message.tsx
- packages/ai/src/agents/agents-chat.tsx
- packages/ai/src/agents/tool-awaiting-input.content.ts
- packages/ai/src/agents/tool-awaiting-input.tsx
- packages/ai/src/agents/virtualized-message-list.test.ts
- packages/ai/src/agents/virtualized-message-list.tsx
- packages/ai/src/components/ask.content.ts
- packages/ai/src/components/ask.tsx
- packages/ai/src/hooks/use-chat/agent-goal-api.ts
- packages/ai/src/hooks/use-chat/use-agent-goal.ts
- packages/ai/src/hooks/use-chat/use-chat.ts

## 缺失原测试（20）

- agents/capability-selection-bar.test.ts
- agents/sql-chart-schema.test.ts
- agents/sql-result-cache-key.test.ts
- agents/subagent-workspace.test.ts
- agents/use-ai-chat-access.test.ts
- agents/workspace-files-panel.test.ts
- components/prompt-input-goal.test.ts
- hooks/use-chat/chat-file-cache-isolation.test.ts
- hooks/use-chat/conversation-groups.test.ts
- hooks/use-chat/request-polling.test.ts
- hooks/use-chat/sql-query-result-export.test.ts
- hooks/use-chat/task-progress-schema.test.ts
- hooks/use-chat/terminal-workspace-artifacts-schema.test.ts
- hooks/use-chat/use-agent-goal-resume.test.ts
- hooks/use-chat/use-chat-messages-websocket.test.ts
- hooks/use-chat/use-chat-pagination.test.ts
- hooks/use-chat/use-chat-stop.test.ts
- hooks/use-chat/use-conversation-shares.test.ts
- lib/conversation-share-route.test.ts
- lib/conversation-share-server-name-crypto.test.ts

目标有 SDK 迁移后的新增和改写测试，因此此数字不代表只有 79 个测试文件或测试能力缺失 20 项。应优先补充停止状态机、执行提示，以及目标恢复等来源变化对应的行为回归。

## 建议顺序与审计边界

优先对齐停止状态机及执行提示；复核目标与 Ask/HITL 的来源变化；再补齐业务封装及通用组件，明确分享、内部工具配置是否纳入开放渠道范围；最后验证公开导出、Registry 闭包、消费端类型与构建。

本次执行文件枚举、摘要比较、关键实现 diff 和本地 Registry 内容核对。未重新运行测试、构建、浏览器或真实服务联调；未声称其通过。机器清单见 artifacts/ai-coverage-inventory.json、ai-coverage-summary.json、ai-diff-files.json；关键组件原始差异见 artifacts/*.tsx.diff 与 use-chat.ts.diff。
