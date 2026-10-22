// Controller 快照中的全部开放聊天入口
export const endpoints = {
  "presign": {
    "method": "POST",
    "path": "/presign",
    "feature": "agent-client",
    "transport": "server"
  },
  "getAgentsConfig": {
    "method": "GET",
    "path": "/config",
    "feature": "agent-client",
    "transport": "json"
  },
  "getConversationConfig": {
    "method": "GET",
    "path": "/conversations/{conversationId}/config",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "createChatStream": {
    "method": "POST",
    "path": "",
    "feature": "agent-client",
    "transport": "json"
  },
  "continueChat": {
    "method": "POST",
    "path": "/conversations/{conversationId}",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getGoal": {
    "method": "GET",
    "path": "/conversations/{conversationId}/goal",
    "feature": "agent-goal",
    "transport": "json"
  },
  "getGoalHistory": {
    "method": "GET",
    "path": "/conversations/{conversationId}/goal/history",
    "feature": "agent-goal",
    "transport": "json"
  },
  "editGoal": {
    "method": "PATCH",
    "path": "/conversations/{conversationId}/goal",
    "feature": "agent-goal",
    "transport": "json"
  },
  "pauseGoal": {
    "method": "POST",
    "path": "/conversations/{conversationId}/goal/pause",
    "feature": "agent-goal",
    "transport": "json"
  },
  "resumeGoal": {
    "method": "POST",
    "path": "/conversations/{conversationId}/goal/resume",
    "feature": "agent-goal",
    "transport": "json"
  },
  "clearGoal": {
    "method": "POST",
    "path": "/conversations/{conversationId}/goal/clear",
    "feature": "agent-goal",
    "transport": "json"
  },
  "interruptByConversation": {
    "method": "DELETE",
    "path": "/conversations/{conversationId}/interrupt",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "compactByConversation": {
    "method": "POST",
    "path": "/conversations/{conversationId}/compact",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationContextUsage": {
    "method": "GET",
    "path": "/conversations/{conversationId}/context-usage",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversations": {
    "method": "GET",
    "path": "/conversations",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationSummary": {
    "method": "GET",
    "path": "/conversations/{conversationId}",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationGroups": {
    "method": "GET",
    "path": "/conversation-groups",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "createConversationGroup": {
    "method": "POST",
    "path": "/conversation-groups",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "renameConversationGroup": {
    "method": "PATCH",
    "path": "/conversation-groups/{groupId}",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "deleteConversationGroup": {
    "method": "DELETE",
    "path": "/conversation-groups/{groupId}",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "moveConversationToGroup": {
    "method": "PATCH",
    "path": "/conversations/{conversationId}/group",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getActiveConversations": {
    "method": "GET",
    "path": "/conversations/active",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getUnreadConversations": {
    "method": "GET",
    "path": "/conversations/unread",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationActivities": {
    "method": "POST",
    "path": "/conversations/activity/query",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "markConversationRead": {
    "method": "PUT",
    "path": "/conversations/{conversationId}/read-receipt",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationStats": {
    "method": "GET",
    "path": "/conversations/stats",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationTitle": {
    "method": "GET",
    "path": "/conversations/{conversationId}/title",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "updateConversationTitle": {
    "method": "PATCH",
    "path": "/conversations/{conversationId}/title",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "updateConversationStatus": {
    "method": "PATCH",
    "path": "/conversations/{conversationId}/status",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "deleteConversation": {
    "method": "DELETE",
    "path": "/conversations/{conversationId}",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getSqlQueryResult": {
    "method": "GET",
    "path": "/conversations/{conversationId}/sql-query-results/{resultId}",
    "feature": "agent-sql",
    "transport": "json"
  },
  "getSqlQueryChartData": {
    "method": "GET",
    "path": "/conversations/{conversationId}/sql-query-results/{resultId}/chart-data",
    "feature": "agent-sql",
    "transport": "json"
  },
  "exportSqlQueryResult": {
    "method": "GET",
    "path": "/conversations/{conversationId}/sql-query-results/{resultId}/export",
    "feature": "agent-sql",
    "transport": "download"
  },
  "getConversationMessages": {
    "method": "GET",
    "path": "/conversations/{conversationId}/messages",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "syncConversationMessages": {
    "method": "GET",
    "path": "/conversations/{conversationId}/messages/sync",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationMessage": {
    "method": "GET",
    "path": "/conversations/{conversationId}/messages/{messageId}",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getConversationAsyncTasks": {
    "method": "GET",
    "path": "/conversations/{conversationId}/async-tasks",
    "feature": "agent-async-tasks",
    "transport": "json"
  },
  "syncConversationAsyncTasks": {
    "method": "GET",
    "path": "/conversations/{conversationId}/async-tasks/sync",
    "feature": "agent-async-tasks",
    "transport": "json"
  },
  "getConversationAsyncTask": {
    "method": "GET",
    "path": "/conversations/{conversationId}/async-tasks/{asyncTaskId}",
    "feature": "agent-async-tasks",
    "transport": "json"
  },
  "getConversationSubagents": {
    "method": "GET",
    "path": "/conversations/{conversationId}/subagents",
    "feature": "agent-subagents",
    "transport": "json"
  },
  "syncConversationSubagents": {
    "method": "GET",
    "path": "/conversations/{conversationId}/subagents/sync",
    "feature": "agent-subagents",
    "transport": "json"
  },
  "getConversationSubagent": {
    "method": "GET",
    "path": "/conversations/{conversationId}/subagents/{subagentTaskId}",
    "feature": "agent-subagents",
    "transport": "json"
  },
  "getConversationSubagentResult": {
    "method": "GET",
    "path": "/conversations/{conversationId}/subagents/{subagentTaskId}/result",
    "feature": "agent-subagents",
    "transport": "json"
  },
  "cancelConversationSubagent": {
    "method": "DELETE",
    "path": "/conversations/{conversationId}/subagents/{subagentTaskId}",
    "feature": "agent-subagents",
    "transport": "json"
  },
  "cancelQueuedMessage": {
    "method": "DELETE",
    "path": "/conversations/{conversationId}/messages/{messageId}/queue",
    "feature": "agent-conversations",
    "transport": "json"
  },
  "getChatEvents": {
    "method": "GET",
    "path": "/events",
    "feature": "agent-session",
    "transport": "json"
  },
  "getChatEventsBatch": {
    "method": "POST",
    "path": "/events/batch",
    "feature": "agent-session",
    "transport": "json"
  },
  "approvePlan": {
    "method": "POST",
    "path": "/plan/approve",
    "feature": "agent-interactions",
    "transport": "json"
  },
  "getPlanStatus": {
    "method": "GET",
    "path": "/plan/{planId}/status",
    "feature": "agent-interactions",
    "transport": "json"
  },
  "getMessagePlanStatus": {
    "method": "GET",
    "path": "/conversations/{conversationId}/messages/{messageId}/plan/status",
    "feature": "agent-interactions",
    "transport": "json"
  },
  "getUserInputStatus": {
    "method": "GET",
    "path": "/user-input/{questionId}/status",
    "feature": "agent-interactions",
    "transport": "json"
  },
  "submitUserInputAnswer": {
    "method": "POST",
    "path": "/user-input/answer",
    "feature": "agent-interactions",
    "transport": "json"
  },
  "generatePreSignedWriteUrl": {
    "method": "POST",
    "path": "/files/pre-signed-url/write",
    "feature": "agent-files",
    "transport": "json"
  },
  "confirmPreSignedUrlUpload": {
    "method": "POST",
    "path": "/files/pre-signed-url/confirm",
    "feature": "agent-files",
    "transport": "json"
  },
  "createFile": {
    "method": "POST",
    "path": "/files/contentMd5",
    "feature": "agent-files",
    "transport": "json"
  },
  "existsMetaByContentMd5": {
    "method": "GET",
    "path": "/files/meta/contentMd5",
    "feature": "agent-files",
    "transport": "json"
  },
  "generatePreSignedReadUrlSimple": {
    "method": "GET",
    "path": "/conversations/{conversationId}/files/{fileId}/preview",
    "feature": "agent-files",
    "transport": "json"
  },
  "generatePlanIntermediateFilePreviewUrl": {
    "method": "GET",
    "path": "/conversations/{conversationId}/messages/{messageId}/plan-intermediate-files/{fileId}/preview",
    "feature": "agent-interactions",
    "transport": "json"
  },
  "batchGetCitationMetadata": {
    "method": "POST",
    "path": "/knowledge-bases/citations/metadata",
    "feature": "agent-citations",
    "transport": "json"
  },
  "getCitationMetadata": {
    "method": "GET",
    "path": "/knowledge-bases/citations/{citationType}/{referenceId}/metadata",
    "feature": "agent-citations",
    "transport": "json"
  },
  "listWorkspaceFiles": {
    "method": "GET",
    "path": "/conversations/{conversationId}/workspace/files",
    "feature": "agent-workspace",
    "transport": "json"
  },
  "generateWorkspaceFilePreviewUrl": {
    "method": "GET",
    "path": "/conversations/{conversationId}/workspace/files/preview",
    "feature": "agent-workspace",
    "transport": "json"
  },
  "getChatStreamBySseConversation": {
    "method": "POST",
    "path": "/conversations/{conversationId}/stream",
    "feature": "agent-session",
    "transport": "sse"
  },
  "getChatStreamByWsConversation": {
    "method": "WS",
    "path": "/conversations/{conversationId}/stream/ws",
    "feature": "agent-session",
    "transport": "ws"
  },
  "streamProbe": {
    "method": "POST",
    "path": "/stream-probe",
    "feature": "agent-session",
    "transport": "sse"
  }
} as const;
export type OpenApiOperation = keyof typeof endpoints;
