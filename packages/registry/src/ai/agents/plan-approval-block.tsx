/**
 * 计划审批交互组件
 *
 * 当后端通过 tool-execution 事件推送 submit_plan + planApproval 扩展时，
 * 使用 Plan 组件族渲染计划内容和审批按钮供用户操作
 *
 * @author 思追(shaco)
 */
"use client"

import React, {useCallback, useState} from "react"
import {CheckCircle2, ClockIcon, Loader2, XCircle} from "lucide-react"
import {useAgentMessages} from "../../i18n/runtime"
import {AutosizeTextarea} from "../../ui/components/autosize-textarea"
import {cn} from "../../ui/lib/utils"
import {MessageResponse} from "../components/message"
import {Plan, PlanContent, PlanFooter} from "../components/plan"
import {ToolCallStatusEnum} from "../hooks/use-chat/schema"
import {useServerCountdown} from "../hooks/use-chat/use-server-countdown"
import {formatWorkingDuration} from "../lib/time"
import {usePlanIntermediateFileContentRequest} from "../hooks/use-chat/use-file-content-callback"
import {useAiChatContext} from "./context"

export type PlanApprovalBlockProps = {
  /** 计划审批静态快照文件 ID */
  previewFileId: number
  /** 计划审批所属消息 ID */
  messageId: string
  /** 服务端生成审批事件时的 UTC 时间 */
  serverNow: Date | string
  /** 服务端定义的审批截止 UTC 时间 */
  approvalTimeoutAt: Date | string
  /** 当前工具状态 */
  status: string
  /** 审批回调 */
  onApprove?: (approved: boolean, feedback?: string) => void
  /** 是否已禁用 */
  disabled?: boolean
}

/** 终态集合 */
const FINAL_STATES: ReadonlySet<string> = new Set([
  ToolCallStatusEnum.Success,
  ToolCallStatusEnum.Blocked,
  ToolCallStatusEnum.Skipped,
  ToolCallStatusEnum.NoResult,
  ToolCallStatusEnum.Error,
  ToolCallStatusEnum.Timeout,
  ToolCallStatusEnum.Interrupted,
])

/**
 * 计划审批交互组件
 */
export function PlanApprovalBlock(props: PlanApprovalBlockProps) {
  const {conversationId} = useAiChatContext()

  if (!conversationId) return null

  return <PlanApprovalBlockContent {...props} conversationId={conversationId}/>
}

function PlanApprovalBlockContent(
  {
    previewFileId,
    messageId,
    serverNow,
    approvalTimeoutAt,
    status,
    onApprove,
    disabled = false,
    conversationId,
  }: PlanApprovalBlockProps & {conversationId: string}) {
  const t = useAgentMessages("plan-approval-block")
  const {httpClient} = useAiChatContext()
  const {data: planContent, loading, error} = usePlanIntermediateFileContentRequest(
    httpClient,
    conversationId,
    messageId,
    previewFileId,
  )

  const [submitted, setSubmitted] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [feedback, setFeedback] = useState("")

  const isFinal = FINAL_STATES.has(status)
  const isAwaitingApproval = status === ToolCallStatusEnum.AwaitingApproval && !submitted
  const {remainingSeconds, isTimeout} = useServerCountdown(
    {serverNow, timeoutAt: approvalTimeoutAt},
    {enabled: isAwaitingApproval},
  )
  const isCountdownExpired = isAwaitingApproval && isTimeout
  const isDisabled = disabled || !onApprove || submitted || isFinal || isCountdownExpired
  const shouldShowFooter = status === ToolCallStatusEnum.AwaitingApproval && !submitted

  const handleApprove = useCallback(() => {
    if (isDisabled) return
    setSubmitted(true)
    onApprove?.(true)
  }, [isDisabled, onApprove])

  const handleReject = useCallback(() => {
    if (isDisabled || !feedback.trim()) return
    setSubmitted(true)
    onApprove?.(false, feedback.trim())
  }, [isDisabled, feedback, onApprove])

  function renderStatusBadge() {
    // 用户提交审批后，等待后端最终状态期间不再展示“等待审批”等中间状态。
    if (submitted && !isFinal) {
      return null
    }

    if (isCountdownExpired) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClockIcon className="size-3.5"/>
          <span>{t.timeout}</span>
        </div>
      )
    }

    switch (status) {
      case ToolCallStatusEnum.AwaitingApproval:
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5"/>
            <span>{t.remaining({duration: formatWorkingDuration(0, remainingSeconds * 1000)})}</span>
          </div>
        )
      case ToolCallStatusEnum.Success:
        return (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="size-3.5"/>
            <span>{t.approved}</span>
          </div>
        )
      case ToolCallStatusEnum.Blocked:
        return (
          <div className="flex items-center gap-1.5 text-xs text-warning">
            <XCircle className="size-3.5"/>
            <span>{t.blocked}</span>
          </div>
        )
      case ToolCallStatusEnum.Skipped:
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <XCircle className="size-3.5"/>
            <span>{t.skipped}</span>
          </div>
        )
      case ToolCallStatusEnum.Timeout:
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5"/>
            <span>{t.timeout}</span>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Plan open={true} isStreaming={loading}>
      <PlanContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin"/>
            <span>{t.loadingPlan}</span>
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{t.planLoadError}</div>
        ) : (
          <div className="whitespace-pre-wrap max-h-[400px] overflow-auto">
            <MessageResponse>
              {planContent ?? t.noContent.value}
            </MessageResponse>
          </div>
        )}
      </PlanContent>
      {shouldShowFooter && (
        <PlanFooter>
          {/* 审批操作区域 */}
          {onApprove && !isCountdownExpired && (
            <div className="flex flex-col gap-2 text-sm pt-2 w-full max-w-full">
              <button
                type="button"
                className="text-brand-action hover:underline disabled:text-muted-foreground disabled:no-underline w-fit"
                disabled={isDisabled}
                onClick={handleApprove}
              >
                {t.approve}
              </button>

              <div className="w-full max-w-full space-y-1">
                <button
                  type="button"
                  className={cn(
                    "hover:underline w-fit",
                    showReject && feedback.trim() ? "text-destructive" : "text-foreground/60 hover:text-destructive",
                  )}
                  disabled={isDisabled}
                  onClick={() => {
                    if (showReject && feedback.trim()) {
                      handleReject()
                    } else {
                      setFeedback("")
                      setShowReject(!showReject)
                    }
                  }}
                >
                  {t.rejectWithNote}
                </button>
                {showReject && (
                  <AutosizeTextarea
                    value={feedback}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && !e.shiftKey && feedback.trim()) {
                        e.preventDefault()
                        handleReject()
                      }
                    }}
                    placeholder={t.feedbackPlaceholder.value}
                    minHeight={36}
                    maxHeight={160}
                    className="w-full"
                    disabled={isDisabled}
                  />
                )}
              </div>

              {/* 倒计时紧跟在拒绝说明区域之后，避免与操作区分离。 */}
              <div className="mt-2">
                {renderStatusBadge()}
              </div>
            </div>
          )}

          {!onApprove && renderStatusBadge()}
          {isCountdownExpired && renderStatusBadge()}
        </PlanFooter>
      )}
    </Plan>
  )
}
