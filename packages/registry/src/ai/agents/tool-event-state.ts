import type {AiChatAwaitingInputBriefEvent, PlanApprovalExtensionContent} from '@lingya-ai/agents-sdk/browser';
import {AiChatEventTypeEnum, type JsRunScriptContent, type JsRunScriptResultContent, type MathFormulaContent, type MathResultContent, type SqlChartResultContent, type SqlQueryResultContent, TOOL_EXTENSION_CATEGORY, ToolAction, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import type {AssistantChatMessage} from "../hooks/use-chat/types"
import type {SubAgentInfo} from "../hooks/use-chat/use-sub-agent-messages"

/** 单个工具根据事件流归并后的展示状态。 */
export interface ToolDerivedState {
  state: string
  action: string
  summary?: string | null
  responseData?: string | null
  errorMessage?: string | null
  subAgentInfo?: SubAgentInfo
  awaitingInput?: Pick<AiChatAwaitingInputBriefEvent, 'questionId' | 'question' | 'questionDetails' | 'options' | 'multiple' | 'serverNow' | 'timeoutSeconds'>
  imageFileId?: number
  planApproval?: PlanApprovalExtensionContent
  askUserSelectedOptions?: string[]
  askUserCustomInput?: string | null
  sqlQuery?: string
  /** 当前 SQL 结果扩展事件携带的工具摘要，用作结果卡片标题。 */
  sqlResultSummary?: string | null
  sqlQueryResult?: SqlQueryResultContent
  sqlChartResult?: SqlChartResultContent
  mathFormula?: MathFormulaContent
  mathResult?: MathResultContent
  jsRunScript?: JsRunScriptContent
  jsRunScriptResult?: JsRunScriptResultContent
}

/**
 * SDK 公开业务事件不提供 sequence，始终保留订阅或历史接口的事件顺序。
 */
export function orderToolEvents(events: AssistantChatMessage[]): AssistantChatMessage[] { return events; }

/**
 * 按 toolId 归并工具事件。后续不带 extension 的状态事件只更新执行状态，不清空已收到的专业结果。
 */
export function deriveToolStates(events: AssistantChatMessage[]): Map<string, ToolDerivedState> {
  const map = new Map<string, ToolDerivedState>()

  for (const event of orderToolEvents(events)) {
    if ("rawJson" in event) continue;
    if (event.type === AiChatEventTypeEnum.ToolExecution) {
      const current = map.get(event.toolId) ?? {
        state: ToolCallStatusEnum.Pending,
        action: ToolAction.DEFAULT,
      }
      const next = {...current}

      if (event.action) next.action = event.action

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.IMAGE_GENERATION) {
        next.imageFileId = event.extension.content.fileId
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL) {
        next.planApproval = {
          previewFileId: event.extension.content.previewFileId,
          serverNow: event.extension.content.serverNow,
          approvalTimeoutAt: event.extension.content.approvalTimeoutAt,
        }
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.ASK_USER_QUESTION) {
        next.askUserSelectedOptions = event.extension.content.selectedOptions
        next.askUserCustomInput = event.extension.content.customInput
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.SQL_QUERY) {
        next.sqlQuery = event.extension.content.sql
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.SQL_QUERY_RESULT) {
        next.sqlQueryResult = event.extension.content
        next.sqlResultSummary = event.summary
        delete next.sqlChartResult
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.SQL_CHART_RESULT) {
        next.sqlChartResult = event.extension.content
        next.sqlResultSummary = event.summary
        delete next.sqlQueryResult
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.MATH_FORMULA) {
        next.mathFormula = event.extension.content
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.MATH_RESULT) {
        next.mathResult = event.extension.content
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.JS_RUN_SCRIPT) {
        next.jsRunScript = event.extension.content
      }

      if (event.extension?.category === TOOL_EXTENSION_CATEGORY.JS_RUN_SCRIPT_RESULT) {
        next.jsRunScriptResult = event.extension.content
      }

      switch (event.status) {
        case ToolCallStatusEnum.Running:
        case ToolCallStatusEnum.Pending:
          next.state = event.status
          next.summary = event.summary || next.summary
          break
        case ToolCallStatusEnum.Success:
          next.state = ToolCallStatusEnum.Success
          next.responseData = event.summary
          break
        case ToolCallStatusEnum.NoResult:
          next.state = ToolCallStatusEnum.NoResult
          break
        case ToolCallStatusEnum.Error:
          next.state = ToolCallStatusEnum.Error
          next.errorMessage = event.summary
          break
        case ToolCallStatusEnum.Blocked:
          next.state = ToolCallStatusEnum.Blocked
          next.errorMessage = event.summary
          break
        case ToolCallStatusEnum.Timeout:
          next.state = ToolCallStatusEnum.Timeout
          next.errorMessage = event.summary
          break
        case ToolCallStatusEnum.Skipped:
          next.state = ToolCallStatusEnum.Skipped
          next.responseData = event.summary
          break
        case ToolCallStatusEnum.Interrupted:
          next.state = ToolCallStatusEnum.Interrupted
          next.summary = event.summary
          break
        default:
          next.state = event.status
          break
      }

      map.set(event.toolId, next)
      continue
    }

    if (event.type === AiChatEventTypeEnum.ToolExecutionSubAgentCall) {
      const current = map.get(event.toolCallId) ?? {
        state: ToolCallStatusEnum.Pending,
        action: ToolAction.DEFAULT,
      }
      map.set(event.toolCallId, {
        ...current,
        state: ToolCallStatusEnum.Running,
        subAgentInfo: {
          conversationId: event.subAgentConversationId,
          messageId: event.subAgentMessageId,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
        },
      })
      continue
    }

    if (event.type === AiChatEventTypeEnum.ToolExecutionAwaitingUserInput) {
      const current = map.get(event.toolCallId) ?? {
        state: ToolCallStatusEnum.Pending,
        action: ToolAction.DEFAULT,
      }
      map.set(event.toolCallId, {
        ...current,
        state: ToolCallStatusEnum.Running,
        awaitingInput: {
          questionId: event.questionId,
          question: event.question,
          questionDetails: event.questionDetails,
          options: event.options,
          multiple: event.multiple,
          serverNow: event.serverNow,
          timeoutSeconds: event.timeoutSeconds,
        },
      })
    }
  }

  return map
}
