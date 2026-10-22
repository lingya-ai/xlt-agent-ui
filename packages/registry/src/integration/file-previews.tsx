"use client";
import {lazy, type ReactNode} from "react";
import {AgentMediaProvider} from "./media";
const FilePreview = lazy(() => import("../file-preview/components/file-preview").then(module => ({default: module.FilePreview})));
/** 文件预览条目显式引入 Office、PDF 等预览依赖，加载时才请求代码。 */
export function AgentFilePreviewsProvider({children}: {children: ReactNode}) {
  return <AgentMediaProvider filePreview={FilePreview}>{children}</AgentMediaProvider>;
}
