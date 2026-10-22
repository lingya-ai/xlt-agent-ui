import {AiChatAwaitingInputBriefEventFromJSON, AiChatToolExecutionBriefEventFromJSON} from "@lingya-ai/agents-sdk/browser";
import {describe, expect, it} from "vitest"

import {ToolAction, AiChatEventTypeEnum, TOOL_EXTENSION_CATEGORY, ToolCallStatusEnum} from "../hooks/use-chat/schema";
import {deriveToolStates, orderToolEvents} from "./tool-event-state"

const resultSchema = [{name: "value", type: "DECIMAL" as const, nullable: true, precision: 18, scale: 2}]
const chart = {
  version: 1,
  type: "BAR" as const,
  title: "Value",
  subtitle: null,
  categoryColumn: "value",
  categoryType: "CATEGORY" as const,
  orientation: "VERTICAL" as const,
  series: [{
    name: "Value",
    valueColumn: "value",
    renderType: "BAR" as const,
    axis: "PRIMARY" as const,
    numberFormat: {type: "NUMBER" as const, decimalPlaces: 2},
    stack: null,
  }],
  legend: false,
  dataZoom: "NONE" as const,
  nullPolicy: "GAP" as const,
}

function createToolEvent(
  sequence: number | undefined,
  summary: string,
  overrides: Record<string, unknown> = {}
) {
  return AiChatToolExecutionBriefEventFromJSON({
    type: AiChatEventTypeEnum.ToolExecution,
    toolId: "tool-1",
    toolName: "excel_sql_query",
    status: ToolCallStatusEnum.Running,
    action: ToolAction.DEFAULT,
    summary,
    ...overrides,
  })
}

describe("orderToolEvents", () => {
  it("SDK 未发布 sequence，工具事件始终保留接口顺序", () => {
    const ordered = orderToolEvents([
      createToolEvent(2, "second-a"),
      createToolEvent(1, "first"),
      createToolEvent(2, "second-b"),
    ])

    expect(ordered.map((event) => "summary" in event ? event.summary : null))
      .toEqual(["second-a", "first", "second-b"])
  })

  it("历史事件存在缺失 sequence 时保持接口顺序", () => {
    const events = [createToolEvent(undefined, "history-first"), createToolEvent(1, "history-second")]

    expect(orderToolEvents(events)).toBe(events)
  })
})

describe("deriveToolStates", () => {
  it("图表结果在 Running 阶段到达后，不会被后续无 extension 的 Success 清空", () => {
    const chartEvent = createToolEvent(2, "图表已生成", {
      extension: {
        category: TOOL_EXTENSION_CATEGORY.SQL_CHART_RESULT,
        content: {
          resultId: "result-1",
          rowCount: 1,
          columnCount: 1,
          columns: ["value"],
          schema: resultSchema,
          chart,
          qualitySummary: {nullValueCount: 0, nullValueColumns: [], zeroFilledValueCount: 0},
          timeContext: {asOfInstant: "2026-07-23T00:00:00Z", tenantZoneId: "Asia/Shanghai"},
        },
      },
    })
    const successEvent = createToolEvent(3, "执行完成", {status: ToolCallStatusEnum.Success})

    const derived = deriveToolStates([chartEvent, successEvent]).get("tool-1")

    expect(derived?.state).toBe(ToolCallStatusEnum.Success)
    expect(derived?.sqlChartResult?.resultId).toBe("result-1")
    expect(derived?.sqlResultSummary).toBe("图表已生成")
    expect(derived?.sqlQueryResult).toBeUndefined()
  })

  it("Timeout 状态保留超时摘要，作为失败信息展示", () => {
    const timeoutEvent = createToolEvent(1, "工具执行超过 30 秒", {
      status: ToolCallStatusEnum.Timeout,
    })

    const derived = deriveToolStates([timeoutEvent]).get("tool-1")

    expect(derived?.state).toBe(ToolCallStatusEnum.Timeout)
    expect(derived?.errorMessage).toBe("工具执行超过 30 秒")
  })

  it("同一工具只保留最后到达的 SQL 专业结果类型", () => {
    const queryEvent = createToolEvent(1, "表格已生成", {
      extension: {
        category: TOOL_EXTENSION_CATEGORY.SQL_QUERY_RESULT,
        content: {
          resultId: "result-table",
          rowCount: 1,
          totalRowCount: 1,
          columnCount: 1,
          columns: ["value"],
          schema: resultSchema,
          truncated: false,
          limit: 100,
        },
      },
    })
    const chartEvent = createToolEvent(2, "图表已生成", {
      extension: {
        category: TOOL_EXTENSION_CATEGORY.SQL_CHART_RESULT,
        content: {
          resultId: "result-chart",
          rowCount: 1,
          columnCount: 1,
          columns: ["value"],
          schema: resultSchema,
          chart,
          qualitySummary: {nullValueCount: 0, nullValueColumns: [], zeroFilledValueCount: 0},
          timeContext: {asOfInstant: "2026-07-23T00:00:00Z", tenantZoneId: "Asia/Shanghai"},
        },
      },
    })

    const derived = deriveToolStates([queryEvent, chartEvent]).get("tool-1")

    expect(derived?.sqlChartResult?.resultId).toBe("result-chart")
    expect(derived?.sqlResultSummary).toBe("图表已生成")
    expect(derived?.sqlQueryResult).toBeUndefined()
  })
  it("等待用户输入事件会保留服务端倒计时时间", () => {
    const awaitingInputEvent = AiChatAwaitingInputBriefEventFromJSON({
      type: AiChatEventTypeEnum.ToolExecutionAwaitingUserInput,
      sequence: 1,
      toolCallId: "tool-1",
      toolName: "ask_user",
      questionId: "question-1",
      question: "是否继续？",
      questionDetails: "继续后将执行后续步骤。",
      options: [
        {text: "继续", recommended: true},
        {text: "停止", recommended: false},
      ],
      multiple: false,
      serverNow: "2026-08-03T00:00:00.000Z",
      timeoutSeconds: 60,
    })

    const derived = deriveToolStates([awaitingInputEvent]).get("tool-1")

    expect(derived?.awaitingInput).toEqual({
      questionId: "question-1",
      question: "是否继续？",
      questionDetails: "继续后将执行后续步骤。",
      options: [
        {text: "继续", recommended: true},
        {text: "停止", recommended: false},
      ],
      multiple: false,
      serverNow: new Date("2026-08-03T00:00:00.000Z"),
      timeoutSeconds: 60,
    })
  })

  it("SDK 可选问题说明未提供时不自动补空字符串",()=>{
 const serverNow=new Date("2026-08-03T00:00:00Z");
 const event={type:"tool-execution-awaiting-user-input" as const,toolCallId:"tool-1",toolName:"ask_user",questionId:"q",question:"是否继续？",options:[{text:"继续",recommended:true}],multiple:false,serverNow,timeoutSeconds:60,questionDetails:undefined};
 const derived=deriveToolStates([event]).get("tool-1");
 expect(derived?.awaitingInput?.serverNow).toBe(serverNow);
 expect(derived?.awaitingInput?.questionDetails).toBeUndefined();
})

  it("SDK 可选问题说明保持 null",()=>{
 const serverNow=new Date("2026-08-03T00:00:00Z");
 const event={type:"tool-execution-awaiting-user-input" as const,toolCallId:"tool-1",toolName:"ask_user",questionId:"q",question:"是否继续？",options:[{text:"继续",recommended:true}],multiple:false,serverNow,timeoutSeconds:60,questionDetails:null};
 const derived=deriveToolStates([event]).get("tool-1");
 expect(derived?.awaitingInput?.serverNow).toBe(serverNow);
 expect(derived?.awaitingInput?.questionDetails).toBeNull();
})

  it("SDK 回答扩展直接使用 selectedOptions", () => {
    const answeredEvent = createToolEvent(1, "已回答", {
      extension: {
        category: TOOL_EXTENSION_CATEGORY.ASK_USER_QUESTION,
        content: {selectedOptions:["继续"],customInput:null},
      },
    })

    expect(deriveToolStates([answeredEvent]).get("tool-1")?.askUserSelectedOptions)
      .toEqual(["继续"])
    expect(deriveToolStates([answeredEvent]).get("tool-1")?.askUserCustomInput)
      .toBeNull()
  })

  it("自定义回答扩展会保留独立字段", () => {
    const answeredEvent = createToolEvent(1, "已回答", {
      extension: {
        category: TOOL_EXTENSION_CATEGORY.ASK_USER_QUESTION,
        content: {selectedOptions: [], customInput: "补充说明"},
      },
    })

    expect(deriveToolStates([answeredEvent]).get("tool-1")).toMatchObject({
      askUserSelectedOptions: [],
      askUserCustomInput: "补充说明",
    })
  })

  it("计划审批事件会保留服务端倒计时时间", () => {
    const planApprovalEvent = createToolEvent(1, "等待审批", {
      status: ToolCallStatusEnum.AwaitingApproval,
      extension: {
        category: TOOL_EXTENSION_CATEGORY.PLAN_APPROVAL,
        content: {
          previewFileId: 100,
          serverNow: "2026-08-03T00:00:00.000Z",
          approvalTimeoutAt: "2026-08-03T00:30:00.000Z",
        },
      },
    })

    const derived = deriveToolStates([planApprovalEvent]).get("tool-1")

    expect(derived?.state).toBe(ToolCallStatusEnum.AwaitingApproval)
    expect(derived?.planApproval).toEqual({
      previewFileId: 100,
      serverNow: new Date("2026-08-03T00:00:00.000Z"),
      approvalTimeoutAt: new Date("2026-08-03T00:30:00.000Z"),
    })
  })

})
