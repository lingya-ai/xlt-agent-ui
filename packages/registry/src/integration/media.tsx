"use client";
import {createContext, useContext, useMemo, Suspense, type ComponentType, type ReactNode} from "react";
import type {FilePreviewProps} from "../file-preview/props";
import {downloadFile} from "../file-preview/utils/download-file";
import type {SqlQueryChartViewProps} from "./chart-view-props";
import {Button} from "../ui/components/button";
import {toast} from "../ui/components/sonner";
import {useAgentMessages} from "../i18n/runtime";

export interface AgentMediaRenderers {
  filePreview?: ComponentType<FilePreviewProps>;
  sqlChart?: ComponentType<SqlQueryChartViewProps>;
}
const MediaContext = createContext<AgentMediaRenderers>({});

/** 按需注入重型渲染器，基础聊天不引用预览或图表实现。嵌套 Provider 合并能力。 */
export function AgentMediaProvider({children, filePreview, sqlChart}: AgentMediaRenderers & {children: ReactNode}) {
  const parent = useContext(MediaContext);
  const value = useMemo(() => ({filePreview: filePreview ?? parent.filePreview, sqlChart: sqlChart ?? parent.sqlChart}),
    [parent, filePreview, sqlChart]);
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function OptionalFilePreview(props: FilePreviewProps) {
  const {filePreview: Preview} = useContext(MediaContext);
  const t = useAgentMessages("optional-capabilities");
  if (Preview) return <Suspense fallback={<p role="status">{props.fileName}</p>}><Preview {...props}/></Suspense>;
  return <div className="flex min-h-0 flex-col items-start gap-3 p-4">
    <p>{t.previewUnavailable}</p>
    <Button variant="outline" onClick={() => {
      if (props.onDownload) props.onDownload(props.src);
      else void downloadFile(props.src, props.fileName).catch(() => toast.error(t.downloadError.value));
    }}>{t.download}</Button>
  </div>;
}

export function OptionalSqlChartView(props: SqlQueryChartViewProps) {
  const {sqlChart: Chart} = useContext(MediaContext);
  const t = useAgentMessages("optional-capabilities");
  if (Chart) return <Suspense fallback={<p role="status">{props.spec.title}</p>}><Chart {...props}/></Suspense>;
  return <div className="space-y-3 p-4"><p>{t.chartUnavailable}</p>
    <Button variant="outline" onClick={props.onShowTable}>{t.showTable}</Button></div>;
}
