"use client"

import {useEffect, useLayoutEffect, useRef, useState} from "react"

import {ChevronDown, ChevronRight} from "lucide-react"
import {useAgentMessages} from "../../i18n/runtime"

import {Tool, ToolContent, ToolHeader, ToolOutput} from "../components/tool"
import {type SubAgentInfo, useSubAgentMessages} from "../hooks/use-chat/use-sub-agent-messages"
import {AgentsChatMessage} from "./agents-chat-message"
import {useAiChatContext} from "./context"
import type {AgentsChatMessageViewMode} from "./message-disclosure-policy"

const MAX_SUB_AGENT_MESSAGE_HEIGHT = 300

/** 子智能体工具的独立渲染属性。 */
export type SubAgentBlockProps = {
  /** 子智能体调用信息。 */
  subAgentInfo: SubAgentInfo
  /** 子智能体消息跟随父消息展示模式。 */
  viewMode?: AgentsChatMessageViewMode
  /** 工具卡片标题。 */
  title: string
  /** 父工具当前状态。 */
  state: string
  /** 父工具动作类型。 */
  action: string
  /** 父工具完成后的返回内容。 */
  output?: string | null
  /** 父工具失败后的错误信息。 */
  errorText?: string | null
  /** 工具详情开合由消息列表外部持久化。 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** 子智能体消息区开合由父列表保存，与工具外框独立。 */
  messagesOpen?: boolean
  onMessagesOpenChange?: (open: boolean) => void
}

/**
 * 独立展示子智能体调用及其消息流。
 *
 * 子智能体不嵌入普通工具卡片，避免嵌套折叠层级影响阅读和交互。
 */
export function SubAgentBlock({
  subAgentInfo,
  viewMode = "compact",
  title,
  state,
  action,
  output,
  errorText,
  open,
  onOpenChange,
  messagesOpen,
  onMessagesOpenChange,
}: SubAgentBlockProps) {
  const t = useAgentMessages("sub-agent-block")
  const {httpClient} = useAiChatContext()
  const [localExpanded, setLocalExpanded] = useState(viewMode === "full")
  const previouslyControlled = useRef(messagesOpen !== undefined)
  useEffect(() => {
    if (previouslyControlled.current && messagesOpen === undefined) setLocalExpanded(viewMode === "full")
    previouslyControlled.current = messagesOpen !== undefined
  }, [messagesOpen, viewMode])
  const expanded = messagesOpen ?? localExpanded
  const handleMessagesOpenChange = (next: boolean) => {
    if (messagesOpen === undefined) setLocalExpanded(next)
    onMessagesOpenChange?.(next)
  }
  const {chatList, isLoading, load, stop} = useSubAgentMessages({httpClient})
  const loadedKeyRef = useRef<string | null>(null)
  const messageViewportRef = useRef<HTMLDivElement>(null)
  const [messageViewportHeight, setMessageViewportHeight] = useState<number>()

  useEffect(() => {
    const key = `${subAgentInfo.conversationId}:${subAgentInfo.messageId}`
    if (loadedKeyRef.current === key) return

    loadedKeyRef.current = key
    void load(subAgentInfo)
  }, [load, subAgentInfo])

  useEffect(() => stop, [stop])

  useLayoutEffect(() => {
    if (!expanded || chatList.length === 0) return

    const content = messageViewportRef.current?.querySelector<HTMLElement>("[data-chat-scroll]")
    if (!content) return

    const updateHeight = () => {
      const nextHeight = Math.min(content.scrollHeight, MAX_SUB_AGENT_MESSAGE_HEIGHT)
      setMessageViewportHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
    }

    const observer = new ResizeObserver(updateHeight)
    observer.observe(content)
    updateHeight()

    return () => observer.disconnect()
  }, [chatList, expanded])

  return (
    <Tool defaultOpen={viewMode === "full"} open={open} onOpenChange={onOpenChange} className="overflow-hidden">
      <ToolHeader
        title={title}
        type={`tool-${subAgentInfo.toolName}`}
        state={state}
        action={action}
      />
      <ToolContent>
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => handleMessagesOpenChange(!expanded)}
            aria-expanded={expanded}
            className="flex w-full items-center gap-1.5 rounded-sm py-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? <ChevronDown className="size-3.5"/> : <ChevronRight className="size-3.5"/>}
            <span>{t.subAgentCall}</span>
          </button>

          {expanded ? (
            <div
              ref={messageViewportRef}
              className="mt-2 min-h-0 w-full"
              style={
                messageViewportHeight === undefined
                  ? undefined
                  : {height: `${messageViewportHeight}px`}
              }
            >
              {isLoading && chatList.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t.loading}</div>
              ) : null}
              {chatList.length > 0 ? (
                <AgentsChatMessage
                  chatList={chatList}
                  conversationId={subAgentInfo.conversationId}
                  showMessageNavigator={false}
                  messageView={{mode: viewMode, switchable: false}}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <ToolOutput output={output ?? undefined} errorText={errorText ?? undefined}/>
      </ToolContent>
    </Tool>
  )
}
