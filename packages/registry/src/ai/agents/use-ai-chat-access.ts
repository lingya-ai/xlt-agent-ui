"use client";
import { useAiChatContext, type AiChatAccessPolicies } from "./context";
import { useAgentMessages } from "../../i18n/runtime";

/** 宿主只控制操作展示，实际授权由 OpenAPI 执行。 */
export function useAiChatAccess() {
  const { accessPolicies } = useAiChatContext();
  const content = useAgentMessages("ai-chat-access");
  const decisionFor = (operation: keyof AiChatAccessPolicies) => accessPolicies?.[operation] ?? null;
  const allowed = (operation: keyof AiChatAccessPolicies) => accessPolicies?.[operation]?.allowed !== false;
  return {
    policies: accessPolicies, decisionFor,
    requireAccess: (operation: keyof AiChatAccessPolicies) => {
      const policy = accessPolicies?.[operation];
      if (policy?.allowed === false) throw new Error(policy.reason ?? content.denied.value);
    },
    canRead: allowed("read"), canSubmit: allowed("submit"), canExecute: allowed("execute"),
    canWrite: allowed("conversationWrite"), canUpload: allowed("attachmentWrite"),
  };
}
