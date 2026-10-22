# 来源与第三方归属

本项目由小灵通前端业务源码移植。提交、未提交改动与文件哈希保存在 `provenance/source.json`。原作者注释与归属信息予以保留。

本项目采用 [MIT 许可证](./LICENSE)。第三方组件、依赖及移植代码保留各自的版权声明与许可证；项目的 MIT 声明不替代或变更这些第三方许可。包元数据中的 `private` 用于防止意外发布到 npm，不表示采用私有许可证。

shadcn/ui 基础组件来源为 [shadcn/ui](https://github.com/shadcn-ui/ui)，采用 MIT 许可证。移植后的 UI 中保留必要的内部交互和 Chromium 102 兼容调整。基础 separator 和 skeleton 同样固定为版本快照，通过 Registry 依赖分发。

AI 交互原始上游参考 [Vercel AI Elements](https://github.com/vercel/ai-elements)，当前上游 LICENSE 声明 Apache-2.0；本项目实际实现来自内部已经内化的组件，不引用 ai-elements 包路径。当前上游声明不代表已经确认每个历史移植文件的许可版本，公开前仍需核对原始版本归属。

已保存 shadcn/ui 的 MIT 原文至 `licenses/shadcn-ui-MIT.txt`，AI Elements 当前上游声明至 `licenses/ai-elements-LICENSE.txt`，Apache-2.0 原文至 `licenses/Apache-2.0.txt`。上述原文于 2026-10-20 从各官方来源获取。

React、Radix UI、Tailwind CSS、Streamdown、Shiki、ECharts、PDF.js、ExcelJS、docx-preview、Viewer.js、PPTX 预览器及其他直接和间接依赖的具体版本、SPDX、作者与上游链接见 `provenance/licenses.json`。该清单使用安装后的 pnpm 许可证元数据生成，不替代各包自带的 LICENSE / NOTICE。

分发时应保留本项目及第三方的版权声明和 LICENSE / NOTICE，并按实际分发内容遵守依赖及预览器运行时资源的许可要求。聚合许可清单不代表已经完成所有第三方归属核对。
