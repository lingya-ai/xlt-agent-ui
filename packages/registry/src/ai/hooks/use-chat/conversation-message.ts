import {z} from 'zod'
export type {ConversationMessage as ConversationMessageOutput, ConversationMessagePage as ConversationMessageList, AiChatBriefEventList as ChatEventsResp} from '@lingya-ai/agents-sdk/browser'
export {ConversationMessageStatus, conversationMessageStatusSchema, hasReplayableMessageEvents, isExecutingMessageStatus, isQueuedMessageStatus, isStreamableMessageStatus, isTerminalMessageStatus} from './conversation-message-status'
/** 查询输入的本地表单约束；响应使用 SDK 类型 */
export const conversationMessageListInputSchema = z.object({current: z.number().int().min(0).nullable().optional(),size:z.number().int().min(1).optional()})
export type ConversationMessageListInput = z.infer<typeof conversationMessageListInputSchema>
