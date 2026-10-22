"use client";
import {AgentsChat, type AgentsChatProps} from "../ai/agents/agents-chat";

/** 最小聊天组合；认证和身份由 AgentProvider 注入。 */
export function AgentChat(props: Omit<AgentsChatProps, "input"> & { input?: AgentsChatProps["input"] }) {
  return <AgentsChat {...props} input={props.input ?? {}} />;
}
