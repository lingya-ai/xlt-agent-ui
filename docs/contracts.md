# OpenAPI 契约覆盖表

SDK 0.7.0，契约 0.1.7。64 个 HTTP 操作及 1 个 WebSocket 入口与后端快照逐项关联。SDK 是类型、请求、认证和流解析的标准实现；UI 不再维护响应 Schema 或路由请求转换层。来源见 provenance/source.json 与 provenance/sdk.json。

| 后端操作 | 相对 /chat 路由 | 后端来源 | SDK Schema | SDK 客户端 | 组件条目 |
|---|---|---|---|---|---|
| presign | POST /presign | OpenApiChannelChatController.kt:70 | OpenApiToken | client.configuration.createOpenApiToken | agent-client |
| getAgentsConfig | GET /config | AbstractAgentsController.kt:373 | AgentsConfig | client.configuration.getAgentsConfig | agent-client |
| getConversationConfig | GET /conversations/{conversationId}/config | AbstractAgentsController.kt:408 | ConversationConfig | client.configuration.getConversationConfig | agent-conversations |
| createChatStream | POST / | AbstractAgentsController.kt:428 | AiChatSubmission | client.chat.createChat | agent-client |
| continueChat | POST /conversations/{conversationId} | AbstractAgentsController.kt:445 | AiChatSubmission | client.chat.continueChat | agent-conversations |
| getGoal | GET /conversations/{conversationId}/goal | AbstractAgentsController.kt:958 | AgentGoalView | client.chat.getGoal | agent-goal |
| getGoalHistory | GET /conversations/{conversationId}/goal/history | AbstractAgentsController.kt:968 | AgentGoalHistory | client.chat.getGoalHistory | agent-goal |
| editGoal | PATCH /conversations/{conversationId}/goal | AbstractAgentsController.kt:980 | AgentGoal | client.chat.editGoal | agent-goal |
| pauseGoal | POST /conversations/{conversationId}/goal/pause | AbstractAgentsController.kt:991 | AgentGoal | client.chat.pauseGoal | agent-goal |
| resumeGoal | POST /conversations/{conversationId}/goal/resume | AbstractAgentsController.kt:1002 | AgentGoal | client.chat.resumeGoal | agent-goal |
| clearGoal | POST /conversations/{conversationId}/goal/clear | AbstractAgentsController.kt:1015 | AgentGoal | client.chat.clearGoal | agent-goal |
| interruptByConversation | DELETE /conversations/{conversationId}/interrupt | AbstractAgentsController.kt:1028 | SDK 空响应或下载字节 | client.chat.interruptConversation | agent-conversations |
| compactByConversation | POST /conversations/{conversationId}/compact | AbstractAgentsController.kt:1049 | SDK 空响应或下载字节 | client.chat.compactConversation | agent-conversations |
| getConversationContextUsage | GET /conversations/{conversationId}/context-usage | AbstractAgentsController.kt:1067 | ConversationContextUsage | client.conversations.getConversationContextUsage | agent-conversations |
| getConversations | GET /conversations | AbstractAgentsController.kt:1103 | ConversationSummaryList | client.conversations.listConversations | agent-conversations |
| getConversationSummary | GET /conversations/{conversationId} | AbstractAgentsController.kt:1113 | ConversationSummary | client.conversations.getConversationSummary | agent-conversations |
| getConversationGroups | GET /conversation-groups | AbstractAgentsController.kt:1137 | ConversationGroupList | client.conversations.listConversationGroups | agent-conversations |
| createConversationGroup | POST /conversation-groups | AbstractAgentsController.kt:1142 | ConversationGroup | client.conversations.createConversationGroup | agent-conversations |
| renameConversationGroup | PATCH /conversation-groups/{groupId} | AbstractAgentsController.kt:1152 | ConversationGroup | client.conversations.renameConversationGroup | agent-conversations |
| deleteConversationGroup | DELETE /conversation-groups/{groupId} | AbstractAgentsController.kt:1164 | ConversationGroupDeleted | client.conversations.deleteConversationGroup | agent-conversations |
| moveConversationToGroup | PATCH /conversations/{conversationId}/group | AbstractAgentsController.kt:1174 | ConversationMetadata | client.conversations.moveConversationToGroup | agent-conversations |
| getActiveConversations | GET /conversations/active | AbstractAgentsController.kt:1193 | ConversationIds | client.conversations.listActiveConversations | agent-conversations |
| getUnreadConversations | GET /conversations/unread | AbstractAgentsController.kt:1200 | ConversationIds | client.conversations.listUnreadConversations | agent-conversations |
| getConversationActivities | POST /conversations/activity/query | AbstractAgentsController.kt:1207 | ConversationActivityList | client.conversations.queryConversationActivities | agent-conversations |
| markConversationRead | PUT /conversations/{conversationId}/read-receipt | AbstractAgentsController.kt:1218 | ConversationReadReceipt | client.conversations.markConversationRead | agent-conversations |
| getConversationStats | GET /conversations/stats | AbstractAgentsController.kt:1244 | ConversationStats | client.conversations.getConversationStats | agent-conversations |
| getConversationTitle | GET /conversations/{conversationId}/title | AbstractAgentsController.kt:1265 | ConversationTitle | client.conversations.getConversationTitle | agent-conversations |
| updateConversationTitle | PATCH /conversations/{conversationId}/title | AbstractAgentsController.kt:1277 | ConversationMetadata | client.conversations.updateConversationTitle | agent-conversations |
| updateConversationStatus | PATCH /conversations/{conversationId}/status | AbstractAgentsController.kt:1291 | SDK 空响应或下载字节 | client.conversations.updateConversationStatus | agent-conversations |
| deleteConversation | DELETE /conversations/{conversationId} | AbstractAgentsController.kt:1304 | SDK 空响应或下载字节 | client.conversations.deleteConversation | agent-conversations |
| getSqlQueryResult | GET /conversations/{conversationId}/sql-query-results/{resultId} | AbstractAgentsController.kt:1324 | SqlQueryResultPage | client.sql.getSqlQueryResult | agent-sql |
| getSqlQueryChartData | GET /conversations/{conversationId}/sql-query-results/{resultId}/chart-data | AbstractAgentsController.kt:1338 | SqlChartDataset | client.sql.getSqlQueryChartData | agent-sql |
| exportSqlQueryResult | GET /conversations/{conversationId}/sql-query-results/{resultId}/export | AbstractAgentsController.kt:1350 | SDK 空响应或下载字节 | client.sql.exportSqlQueryResult | agent-sql |
| getConversationMessages | GET /conversations/{conversationId}/messages | AbstractAgentsController.kt:1366 | ConversationMessagePage | client.messages.listConversationMessages | agent-conversations |
| syncConversationMessages | GET /conversations/{conversationId}/messages/sync | AbstractAgentsController.kt:1378 | ConversationMessageSync | client.messages.syncConversationMessages | agent-conversations |
| getConversationMessage | GET /conversations/{conversationId}/messages/{messageId} | AbstractAgentsController.kt:1400 | ConversationMessage | client.messages.getConversationMessage | agent-conversations |
| getConversationAsyncTasks | GET /conversations/{conversationId}/async-tasks | AbstractAgentsController.kt:1412 | AsyncTaskPage | client.messages.listConversationAsyncTasks | agent-async-tasks |
| syncConversationAsyncTasks | GET /conversations/{conversationId}/async-tasks/sync | AbstractAgentsController.kt:1424 | AgentAsyncTaskSync | client.messages.syncConversationAsyncTasks | agent-async-tasks |
| getConversationAsyncTask | GET /conversations/{conversationId}/async-tasks/{asyncTaskId} | AbstractAgentsController.kt:1436 | AsyncTask | client.messages.getConversationAsyncTask | agent-async-tasks |
| getConversationSubagents | GET /conversations/{conversationId}/subagents | AbstractAgentsController.kt:1448 | SubagentTaskPage | client.messages.listConversationSubagents | agent-subagents |
| syncConversationSubagents | GET /conversations/{conversationId}/subagents/sync | AbstractAgentsController.kt:1460 | SubagentTaskSync | client.messages.syncConversationSubagents | agent-subagents |
| getConversationSubagent | GET /conversations/{conversationId}/subagents/{subagentTaskId} | AbstractAgentsController.kt:1472 | SubagentTask | client.messages.getConversationSubagent | agent-subagents |
| getConversationSubagentResult | GET /conversations/{conversationId}/subagents/{subagentTaskId}/result | AbstractAgentsController.kt:1484 | SubagentTaskResult | client.messages.getConversationSubagentResult | agent-subagents |
| cancelConversationSubagent | DELETE /conversations/{conversationId}/subagents/{subagentTaskId} | AbstractAgentsController.kt:1496 | SubagentTask | client.messages.cancelConversationSubagent | agent-subagents |
| cancelQueuedMessage | DELETE /conversations/{conversationId}/messages/{messageId}/queue | AbstractAgentsController.kt:1508 | ConversationMessage | client.messages.cancelQueuedMessage | agent-conversations |
| getChatEvents | GET /events | AbstractAgentsController.kt:1520 | AiChatBriefEventList | client.events.getChatEvents | agent-session |
| getChatEventsBatch | POST /events/batch | AbstractAgentsController.kt:1532 | AiChatEventsBatch | client.events.getChatEventsBatch | agent-session |
| approvePlan | POST /plan/approve | AbstractAgentsController.kt:1547 | OperationResult | client.interactions.approvePlan | agent-interactions |
| getPlanStatus | GET /plan/{planId}/status | AbstractAgentsController.kt:1569 | PlanStatus | client.interactions.getPlanStatus | agent-interactions |
| getMessagePlanStatus | GET /conversations/{conversationId}/messages/{messageId}/plan/status | AbstractAgentsController.kt:1587 | PlanStatus | client.interactions.getMessagePlanStatus | agent-interactions |
| getUserInputStatus | GET /user-input/{questionId}/status | AbstractAgentsController.kt:1602 | UserInputStatus | client.interactions.getUserInputStatus | agent-interactions |
| submitUserInputAnswer | POST /user-input/answer | AbstractAgentsController.kt:1628 | OperationResult | client.interactions.answerUserInput | agent-interactions |
| generatePreSignedWriteUrl | POST /files/pre-signed-url/write | AbstractAgentsController.kt:1695 | GeneratePreSignedUrlOutput | client.files.createPreSignedUpload | agent-files |
| confirmPreSignedUrlUpload | POST /files/pre-signed-url/confirm | AbstractAgentsController.kt:1720 | AgentFile | client.files.confirmPreSignedUpload | agent-files |
| createFile | POST /files/contentMd5 | AbstractAgentsController.kt:1734 | AgentFile | client.files.createFileByContentMd5 | agent-files |
| existsMetaByContentMd5 | GET /files/meta/contentMd5 | AbstractAgentsController.kt:1748 | FileExists | client.files.fileExistsByContentMd5 | agent-files |
| generatePreSignedReadUrlSimple | GET /conversations/{conversationId}/files/{fileId}/preview | AbstractAgentsController.kt:1759 | PreSignedReadUrl | client.files.getConversationFilePreview | agent-files |
| generatePlanIntermediateFilePreviewUrl | GET /conversations/{conversationId}/messages/{messageId}/plan-intermediate-files/{fileId}/preview | AbstractAgentsController.kt:1771 | PreSignedReadUrl | client.files.getPlanIntermediateFilePreview | agent-interactions |
| batchGetCitationMetadata | POST /knowledge-bases/citations/metadata | AbstractAgentsController.kt:1789 | CitationMetadataList | client.knowledge.getCitationMetadataBatch | agent-citations |
| getCitationMetadata | GET /knowledge-bases/citations/{citationType}/{referenceId}/metadata | AbstractAgentsController.kt:1800 | CitationMetadata | client.knowledge.getCitationMetadata | agent-citations |
| listWorkspaceFiles | GET /conversations/{conversationId}/workspace/files | AbstractAgentsController.kt:1810 | WorkspaceArtifactList | client.workspace.listWorkspaceArtifacts | agent-workspace |
| generateWorkspaceFilePreviewUrl | GET /conversations/{conversationId}/workspace/files/preview | AbstractAgentsController.kt:1822 | PreSignedReadUrl | client.workspace.getWorkspaceFilePreview | agent-workspace |
| getChatStreamBySseConversation | POST /conversations/{conversationId}/stream | AbstractAgentsStreamController.kt:121 | AiChatBriefEvent | client.chat.streamChatEvents | agent-session |
| getChatStreamByWsConversation | WS /conversations/{conversationId}/stream/ws | AbstractAgentsStreamController.kt:138 | SDK AiChatBriefEvent / ConnectionEvent / StreamCloseInfo | client.chat.subscribeChatEvents(..., {transport:"websocket"}) | agent-session |
| streamProbe | POST /stream-probe | AbstractAgentsStreamController.kt:186 | ChatStreamProbeEvent | client.chat.probeEventStream | agent-session |

基础查询可直接调用 SDK，或将 SDK 方法回调传入 useOpenApiOperation；流由 chat.subscribeChatEvents 提供。缓存、重连和 UI 归并由组件负责。

验证边界：本检查仅证明快照路径、SDK 方法与安装实现逐项对应，不代表每个接口已完成运行验证。tests/sdk-ui.test.tsx 覆盖部分直接接入行为；真实渠道测试及全量 UI 验收仍须独立执行。

不适用：渠道管理、发布和 AK/SK 管理不属于公开聊天契约。异步任务没有独立取消操作；子 Agent 使用 cancelConversationSubagent。
