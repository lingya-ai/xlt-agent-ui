import type {ChartExportHandle} from "../charts/types/chart";
import type {ChartSpecV1, SqlChartResultContent} from "../ai/hooks/use-chat/schema";
export interface SqlQueryChartViewProps {
  conversationId: string
  result: SqlChartResultContent
  spec: ChartSpecV1
  onShowTable: () => void
  onExportHandleChange: (handle: ChartExportHandle | null) => void
}

