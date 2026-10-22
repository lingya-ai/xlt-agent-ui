import {AgentsConfig} from "../hooks/use-chat/use-agents-config";
import {createContext, useContext} from "react";

/**
 * AI 聊天配置 Context
 */
export interface AiChatConfigContextOptions {

  config: AgentsConfig

}


const AiChatConfigContext = createContext<AiChatConfigContextOptions | null>(null)

/** Context Provider，由 AgentsChat 注入 */
export const AiChatConfigContextProvider = AiChatConfigContext.Provider

export function useAiChatConfigContext(): AiChatConfigContextOptions {
  const context = useContext(AiChatConfigContext)
  if (!context) {
    throw new Error(`useAiChatConfigContext must be used inside a AiChatConfigContext`)
  }
  return context;
}
