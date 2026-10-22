"use client";

import { useAgentMessages } from "../../i18n/runtime";

import { Tool, ToolContent, ToolHeader, ToolOutput } from "../components/tool";
import { ToolAction, ToolCallStatusEnum } from "../hooks/use-chat/schema";
import { buildToolDisplayModel } from "./tool-display-model";
import type {
  UserInputAnswerMessageParams,
  UserInputAnswerOutput,
} from "../hooks/use-chat/use-hitl";
import { PlanApprovalBlock } from "./plan-approval-block";
import { SqlChartResult } from "./sql-chart-result";
import { SqlQueryResult } from "./sql-query-result";
import { SubAgentBlock } from "./sub-agent-block";
import { TextToImagePreview } from "./text-to-image-preview";
import { ToolAwaitingInput } from "./tool-awaiting-input";
import { ToolActivityRow } from "./tool-activity-row";
import { ToolCodeExtension } from "./tool-code-extension";
import type { ToolPresentation } from "./tool-presentation-projection";
import type { AgentsChatMessageViewMode } from "./message-disclosure-policy";
import { isProtectedTool } from "./unified-assistant-turn";

/** 所有已结束的状态。 */
const COMPLETED_STATES: ReadonlySet<string> = new Set<string>([
  ToolCallStatusEnum.ApprovalDenied,
  ToolCallStatusEnum.ApprovalResponded,
  ToolCallStatusEnum.Success,
  ToolCallStatusEnum.NoResult,
  ToolCallStatusEnum.Blocked,
  ToolCallStatusEnum.Skipped,
  ToolCallStatusEnum.Error,
  ToolCallStatusEnum.Timeout,
  ToolCallStatusEnum.Interrupted,
]);

export type ToolEventsBlockProps = {
  /** 已经集中派生过的工具展示数据。 */
  tools: ToolPresentation[];
  /** 工具详情默认展开策略；未传入时保持重点模式行为。 */
  viewMode?: AgentsChatMessageViewMode;
  /** 会话 ID。 */
  conversationId?: string;
  /** 当前工具所属消息 ID。 */
  messageId?: string;
  /** 当前消息是否已中断。 */
  messageInterrupted?: boolean;
  /** 用户回答提问的回调。 */
  onUserInputAnswer?: (
    params: UserInputAnswerMessageParams,
  ) => Promise<UserInputAnswerOutput>;
  /** 计划审批回调。 */
  onPlanApproval?: (params: {
    messageId: string;
    approved: boolean;
    feedback?: string;
  }) => void;
  /** 虚拟卸载后恢复单个工具详情的开合选择。 */
  getToolOpen?: (toolId: string) => boolean | undefined;
  onToolOpenChange?: (toolId: string, open: boolean) => void;
  /** 子智能体消息区独立于工具详情，按父toolId恢复用户选择。 */
  getSubAgentMessagesOpen?: (toolId: string) => boolean | undefined;
  onSubAgentMessagesOpenChange?: (toolId: string, open: boolean) => void;
};

/**
 * 普通工具使用紧凑活动行；专用结果、交互及子智能体保留既有视图。
 */
export function ToolEventsBlock({
  tools,
  viewMode = "compact",
  conversationId,
  messageId,
  messageInterrupted = false,
  onUserInputAnswer,
  onPlanApproval,
  getToolOpen,
  onToolOpenChange,
  getSubAgentMessagesOpen,
  onSubAgentMessagesOpenChange,
}: ToolEventsBlockProps) {
  const fullProcess = viewMode === "full";
  const t = useAgentMessages("tool-events-block");
  const actionLabels: Record<string, string> = {
    [ToolAction.DEFAULT]: t.actionDefault.value,
    [ToolAction.SEARCH]: t.actionSearch.value,
    [ToolAction.READ]: t.actionRead.value,
    [ToolAction.WRITE]: t.actionWrite.value,
    [ToolAction.UPDATE]: t.actionUpdate.value,
    [ToolAction.DELETE]: t.actionDelete.value,
    [ToolAction.EXECUTE]: t.actionExecute.value,
    [ToolAction.INTERACT]: t.actionInteract.value,
    [ToolAction.DELEGATE]: t.actionDelegate.value,
  };
  /**
   * 无业务摘要时的标题兜底：动作 + 完整工具名。
   *
   * 工具状态仍由右侧状态标签或标题栏徽标展示，不重复写入标题。
   */
  const fallbackTitle = (action: string, toolName: string) =>
    t.fallbackTitle({ action: actionLabels[action] ?? action, toolName }).value;
  const statusLabels: Record<string, string> = {
    [ToolCallStatusEnum.Pending]: t.pending.value,
    [ToolCallStatusEnum.Running]: t.running.value,
    [ToolCallStatusEnum.AwaitingApproval]: t.awaitingApproval.value,
    [ToolCallStatusEnum.ApprovalResponded]: t.approvalResponded.value,
    [ToolCallStatusEnum.Success]: t.success.value,
    [ToolCallStatusEnum.NoResult]: t.noResult.value,
    [ToolCallStatusEnum.Error]: t.error.value,
    [ToolCallStatusEnum.Timeout]: t.timeout.value,
    [ToolCallStatusEnum.ApprovalDenied]: t.approvalDenied.value,
    [ToolCallStatusEnum.Blocked]: t.blocked.value,
    [ToolCallStatusEnum.Skipped]: t.skipped.value,
    [ToolCallStatusEnum.Interrupted]: t.interrupted.value,
  };
  const failureLabels: Partial<Record<string, string>> = {
    [ToolCallStatusEnum.Error]: t.defaultError.value,
    [ToolCallStatusEnum.Timeout]: t.defaultTimeout.value,
    [ToolCallStatusEnum.Blocked]: t.defaultBlocked.value,
    [ToolCallStatusEnum.ApprovalDenied]: t.defaultApprovalDenied.value,
    [ToolCallStatusEnum.Interrupted]: t.defaultInterrupted.value,
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {tools.map((tool) => {
        const { derived } = tool;
        const hasSpecializedResult = Boolean(
          tool.keyResults.length > 0 ||
            derived.mathResult ||
            derived.jsRunScriptResult ||
            derived.askUserSelectedOptions !== undefined,
        );
        // 分享回放没有回答回调，但已完成的用户问答仍需展示问题和用户选择。
        const awaitingInput = derived.awaitingInput;
        const hasCompletedAnswer = derived.askUserSelectedOptions !== undefined;
        const showHistoricalAnswer = hasCompletedAnswer && !awaitingInput;
        const awaitingInputInterrupted = Boolean(
          awaitingInput &&
            !hasCompletedAnswer &&
            (messageInterrupted ||
              derived.state === ToolCallStatusEnum.Interrupted),
        );
        // 只读回放也展示问题；缺少回调时由问答组件禁用交互。
        const showAwaitingInput = Boolean(awaitingInput);
        const display = buildToolDisplayModel(tool);
        const state = awaitingInputInterrupted
          ? ToolCallStatusEnum.Interrupted
          : display.state;
        const title =
          display.businessTitle ?? fallbackTitle(display.action, tool.toolName);
        const errorText =
          display.errorText ??
          (display.failureKind
            ? failureLabels[display.failureKind]
            : undefined);
        const showOutput =
          COMPLETED_STATES.has(derived.state) &&
          Boolean(errorText || (!hasSpecializedResult && display.output));
        const showPlanApproval = Boolean(
          derived.planApproval && Boolean(messageId),
        );
        const hasToolContent = Boolean(
          derived.imageFileId !== undefined ||
            derived.sqlQueryResult ||
            derived.sqlChartResult ||
            derived.mathFormula ||
            derived.mathResult ||
            derived.jsRunScript ||
            derived.jsRunScriptResult ||
            showAwaitingInput ||
            showHistoricalAnswer ||
            showPlanApproval ||
            display.unsupportedPreview ||
            showOutput,
        );
        const autoToolOpen =
          tool.specialRender === true ||
          (!messageInterrupted && isProtectedTool(tool));
        const defaultSpecialViewOpen =
          fullProcess || tool.specialRender === true;
        const headerProps = {
          title,
          type: `tool-${tool.toolName}` as const,
          state,
          action: derived.action,
        };

        if (derived.subAgentInfo) {
          return (
            <SubAgentBlock
              key={tool.key}
              subAgentInfo={derived.subAgentInfo}
              viewMode={viewMode}
              messagesOpen={
                getSubAgentMessagesOpen?.(tool.toolId) ??
                (defaultSpecialViewOpen ? true : undefined)
              }
              onMessagesOpenChange={
                onSubAgentMessagesOpenChange
                  ? (open) => onSubAgentMessagesOpenChange(tool.toolId, open)
                  : undefined
              }
              open={
                getToolOpen?.(tool.toolId) ??
                (defaultSpecialViewOpen ? true : undefined)
              }
              onOpenChange={
                onToolOpenChange
                  ? (open) => onToolOpenChange(tool.toolId, open)
                  : undefined
              }
              title={title}
              state={derived.state}
              action={derived.action}
              output={display.output}
              errorText={errorText}
            />
          );
        }

        const hasDedicatedView = Boolean(
          tool.specialRender === true ||
            hasSpecializedResult ||
            derived.imageFileId !== undefined ||
            derived.sqlQueryResult ||
            derived.sqlChartResult ||
            derived.mathFormula ||
            derived.jsRunScript ||
            derived.awaitingInput ||
            derived.planApproval ||
            display.unsupportedPreview,
        );
        if (!hasDedicatedView) {
          const failed = tool.attention.failed || Boolean(display.failureKind);
          return (
            <ToolActivityRow
              key={tool.key}
              title={
                display.businessTitle ??
                fallbackTitle(display.action, tool.toolName)
              }
              action={display.action}
              statusLabel={statusLabels[state] ?? state}
              state={state}
              failed={failed}
              defaultOpen={fullProcess}
              open={
                getToolOpen
                  ? (getToolOpen(tool.toolId) ?? fullProcess)
                  : fullProcess
                    ? true
                    : undefined
              }
              onOpenChange={
                onToolOpenChange
                  ? (open) => onToolOpenChange(tool.toolId, open)
                  : undefined
              }
            >
              {showOutput ? (
                <ToolOutput output={display.output} errorText={errorText} />
              ) : undefined}
            </ToolActivityRow>
          );
        }

        if (!hasToolContent) {
          return (
            <div
              key={tool.key}
              className="not-prose min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-border bg-card"
            >
              <ToolHeader {...headerProps} collapsible={false} />
            </div>
          );
        }

        return (
          <Tool
            key={tool.key}
            defaultOpen={fullProcess || autoToolOpen}
            open={
              getToolOpen
                ? (getToolOpen(tool.toolId) ?? (fullProcess || autoToolOpen))
                : fullProcess
                  ? true
                  : undefined
            }
            onOpenChange={
              onToolOpenChange
                ? (open) => onToolOpenChange(tool.toolId, open)
                : undefined
            }
            className="overflow-hidden"
          >
            <ToolHeader {...headerProps} />
            <ToolContent>
              {derived.imageFileId !== undefined && (
                <TextToImagePreview fileId={derived.imageFileId} />
              )}
              {derived.sqlQueryResult && (
                <SqlQueryResult
                  key={derived.sqlQueryResult.resultId}
                  conversationId={conversationId}
                  result={derived.sqlQueryResult}
                  title={title}
                  embedded
                />
              )}
              {derived.sqlChartResult && (
                <SqlChartResult
                  key={derived.sqlChartResult.resultId}
                  conversationId={conversationId}
                  result={derived.sqlChartResult}
                  title={title}
                  embedded
                />
              )}
              {derived.mathFormula && (
                <ToolCodeExtension
                  kind="math-formula"
                  code={derived.mathFormula.expression}
                  variables={derived.mathFormula.variables}
                />
              )}
              {derived.mathResult && (
                <ToolCodeExtension
                  kind="math-result"
                  code={derived.mathResult.result}
                />
              )}
              {derived.jsRunScript && (
                <ToolCodeExtension
                  kind="js-script"
                  code={derived.jsRunScript.script}
                />
              )}
              {derived.jsRunScriptResult?.stdout && (
                <ToolCodeExtension
                  kind="js-stdout"
                  code={derived.jsRunScriptResult.stdout}
                />
              )}
              {derived.jsRunScriptResult && (
                <ToolCodeExtension
                  kind="js-result"
                  code={derived.jsRunScriptResult.result}
                />
              )}
              {showOutput && (
                <ToolOutput output={display.output} errorText={errorText} />
              )}
              {display.unsupportedPreview && (
                <p className="p-4 text-sm text-muted-foreground">
                  {t.unsupportedPreview.value}
                </p>
              )}
              {showHistoricalAnswer && (
                <section
                  aria-label={t.historicalAnswer.value}
                  className="flex flex-col gap-2 p-4 text-sm"
                >
                  <h4 className="font-medium">{t.selectedOptions.value}</h4>
                  {derived.askUserSelectedOptions?.length ? (
                    <ul className="flex list-inside list-disc flex-col gap-1">
                      {derived.askUserSelectedOptions.map((option, index) => (
                        <li
                          key={`${index}:${option}`}
                          className="break-words whitespace-pre-wrap"
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">
                      {t.noSelectedOptions.value}
                    </p>
                  )}
                  {derived.askUserCustomInput?.trim() && (
                    <>
                      <h4 className="font-medium">{t.customAnswer.value}</h4>
                      <p className="break-words whitespace-pre-wrap">
                        {derived.askUserCustomInput}
                      </p>
                    </>
                  )}
                </section>
              )}
              {showAwaitingInput && awaitingInput && (
                <ToolAwaitingInput
                  conversationId={conversationId}
                  messageId={messageId}
                  questionId={awaitingInput.questionId}
                  question={awaitingInput.question}
                  questionDetails={awaitingInput.questionDetails ?? ""}
                  options={awaitingInput.options}
                  multiple={awaitingInput.multiple}
                  serverNow={awaitingInput.serverNow}
                  timeoutSeconds={awaitingInput.timeoutSeconds}
                  interrupted={awaitingInputInterrupted}
                  selectedOptions={derived.askUserSelectedOptions}
                  customInput={derived.askUserCustomInput}
                  onAnswer={
                    onUserInputAnswer && messageId
                      ? (answer) =>
                          onUserInputAnswer({
                            questionId: awaitingInput.questionId,
                            ...answer,
                            messageId,
                          })
                      : undefined
                  }
                />
              )}
              {derived.planApproval && messageId && (
                <PlanApprovalBlock
                  previewFileId={derived.planApproval.previewFileId}
                  messageId={messageId}
                  serverNow={derived.planApproval.serverNow}
                  approvalTimeoutAt={derived.planApproval.approvalTimeoutAt}
                  status={derived.state}
                  onApprove={
                    onPlanApproval
                      ? (approved, feedback) =>
                          onPlanApproval({ messageId, approved, feedback })
                      : undefined
                  }
                />
              )}
            </ToolContent>
          </Tool>
        );
      })}
    </div>
  );
}
