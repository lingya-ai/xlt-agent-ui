# 0.2.1 SDK 构建兼容修复

SDK 与公开契约升级至 1.0.0。根项目和 Registry 包统一固定 npm `@lingya-ai/agents-sdk@1.0.0`，移除本地 tarball override，使用 `pnpm install --frozen-lockfile` 安装。

任务进度直接展示 SDK `TaskSummary.content`；引用元数据请求提交 `ReturnedReference.citationType`，响应仍读取 `CitationMetadata.type`；工作区列表保留 SDK 返回的 `fileId`，文件树和预览继续使用 `relativePath`。宿主升级时须一起更新客户端、会话及相关展示条目。

Registry 版本递增为 0.2.1，安装路径为 `/r/0.2.1/`，不覆盖旧版本快照。CI 继续测试 npm latest；本地开发和 Pages 部署通过锁文件固定已验证版本，Pages 不再动态升级 SDK。发布前应审查 latest 引入的契约变化。

`verify:install` 使用 npm 1.0.0 的 tarball fixture，放置于 `.cache/sdk/lingya-ai-agents-sdk-1.0.0.tgz`；SHA-256 记录在 `provenance/sdk.json`。普通开发和 Actions 安装不需要此文件。
