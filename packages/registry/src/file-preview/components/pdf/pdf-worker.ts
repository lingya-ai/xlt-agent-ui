/**
 * @file PDF.js worker 配置
 *
 * 兼容奇安信 Chromium 102 基线（不支持 import.meta.url 顶层 await 等）：
 * - 使用 v3.11.174 legacy build（兼容老版本浏览器）
 * - workerSrc 通过 new URL(..., import.meta.url) 静态分析定位
 */

import * as pdfjs from 'pdfjs-dist'

// 同包产物路径，webpack/turbopack 会识别并单独打包
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString()

export {pdfjs}
