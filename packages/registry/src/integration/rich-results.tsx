"use client";
import type {ReactNode} from "react";
import {AgentFilePreviewsProvider} from "./file-previews";
import {AgentSqlChartsProvider} from "./sql-charts";
/** 完整工作台的重型能力组合；普通聊天可独立选择其中一项。 */
export function AgentRichResultsProvider({children}: {children: ReactNode}) {
  return <AgentFilePreviewsProvider><AgentSqlChartsProvider>{children}</AgentSqlChartsProvider></AgentFilePreviewsProvider>;
}
