package cc.lingya.xiaolingtong.agentruntime

import cc.lingya.xiaolingtong.ai.AgentsConversationGroupService
import cc.lingya.xiaolingtong.ai.AgentsStateMachineFactory
import cc.lingya.xiaolingtong.ai.ConversationActivityService
import cc.lingya.xiaolingtong.ai.SkillService
import cc.lingya.xiaolingtong.ai.agents.ChatUIEventStream
import cc.lingya.xiaolingtong.ai.agents.async_task.AgentAsyncTaskExecutionContext
import cc.lingya.xiaolingtong.ai.agents.async_task.AgentAsyncTaskExecutionRoute
import cc.lingya.xiaolingtong.ai.agents.async_task.AgentAsyncTaskService
import cc.lingya.xiaolingtong.ai.agents.context.BuiltInToolOptions
import cc.lingya.xiaolingtong.ai.agents.context.messages.SessionMessageHelper
import cc.lingya.xiaolingtong.ai.agents.context.state.cancel.CancelReason
import cc.lingya.xiaolingtong.ai.agents.engine.MediaAttachment
import cc.lingya.xiaolingtong.ai.agents.engine.UserMessage
import cc.lingya.xiaolingtong.ai.agents.tools.InternalToolFactory
import cc.lingya.xiaolingtong.ai.agents.tools.askuser.AskUserAnswer
import cc.lingya.xiaolingtong.ai.agents.tools.askuser.store.AskUserMeta
import cc.lingya.xiaolingtong.ai.agents.tools.askuser.store.AskUserQuestionStoreService
import cc.lingya.xiaolingtong.ai.agents.tools.plan.PlanApprovalResult
import cc.lingya.xiaolingtong.ai.agents.tools.plan.store.PlanApprovalStoreService
import cc.lingya.xiaolingtong.ai.agents.tools.subagent.SubagentExecutionContext
import cc.lingya.xiaolingtong.ai.agents.tools.subagent.SubagentTaskQueryService
import cc.lingya.xiaolingtong.ai.agents.tools.subagent.collaboration.AgentCollaborationService
import cc.lingya.xiaolingtong.ai.agents.tools.subagent.collaboration.CollaborationExecutionDescriptor
import cc.lingya.xiaolingtong.ai.agents.tools.workspace.WorkspaceInputFileService
import cc.lingya.xiaolingtong.ai.agents.tools.workspace.dto.MAX_SEGMENT_BYTES
import cc.lingya.xiaolingtong.ai.agents.tools.workspace.text.TextFileSupport
import cc.lingya.xiaolingtong.ai.apps.authoring.model.AuthoringExecutionBinding
import cc.lingya.xiaolingtong.ai.apps.authoring.model.AuthoringExecutionBindingContext
import cc.lingya.xiaolingtong.ai.config.AgentGoalProperties
import cc.lingya.xiaolingtong.ai.model.AgentConversationTypeEnum.SUBAGENT
import cc.lingya.xiaolingtong.ai.model.AgentExecutionType
import cc.lingya.xiaolingtong.ai.model.AgentGoalExecutionRoute
import cc.lingya.xiaolingtong.ai.model.AgentMessageDispatchDisposition
import cc.lingya.xiaolingtong.ai.model.AgentOptions
import cc.lingya.xiaolingtong.ai.model.AgentOptionsContext
import cc.lingya.xiaolingtong.ai.model.AgentsConfigContext
import cc.lingya.xiaolingtong.ai.model.AgentsConversationIdentity
import cc.lingya.xiaolingtong.ai.model.AgentsConversationIdentityContext
import cc.lingya.xiaolingtong.ai.model.AiChatStreamResponse
import cc.lingya.xiaolingtong.ai.model.ChatModelSpec
import cc.lingya.xiaolingtong.ai.model.ConversationMessageStatus
import cc.lingya.xiaolingtong.ai.model.EffectiveChatModelSpecContext
import cc.lingya.xiaolingtong.ai.model.SqlQueryResultExportFormat
import cc.lingya.xiaolingtong.ai.model.chat.brief.AiChatBriefEvent
import cc.lingya.xiaolingtong.ai.model.concurrency.AgentRequestSubmission
import cc.lingya.xiaolingtong.ai.model.concurrency.AgentRequestSubmissionContext
import cc.lingya.xiaolingtong.ai.model.dto.input.PlanApprovalInput
import cc.lingya.xiaolingtong.ai.model.dto.input.UserInputAnswerInput
import cc.lingya.xiaolingtong.ai.model.dto.output.AgentsConfigOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.AttachmentExtOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.DefaultModelOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.ModelConfigOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.ModelKeyGroupOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.PlanApprovalOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.PlanStatusOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.UserInputAnswerOutput
import cc.lingya.xiaolingtong.ai.model.dto.output.UserInputStatusOutput
import cc.lingya.xiaolingtong.ai.model.input.AgentAsyncTaskListInput
import cc.lingya.xiaolingtong.ai.model.input.AgentAsyncTaskSyncInput
import cc.lingya.xiaolingtong.ai.model.input.AgentGoalRefInput
import cc.lingya.xiaolingtong.ai.model.input.AgentsConversationPageInput
import cc.lingya.xiaolingtong.ai.model.input.AgentsConversationStatusInput
import cc.lingya.xiaolingtong.ai.model.input.AgentsConversationTitleInput
import cc.lingya.xiaolingtong.ai.model.input.AgentsMessageListInput
import cc.lingya.xiaolingtong.ai.model.input.AiChatEventsBatchInput
import cc.lingya.xiaolingtong.ai.model.input.AiChatInput
import cc.lingya.xiaolingtong.ai.model.input.ConversationActivityBatchInput
import cc.lingya.xiaolingtong.ai.model.input.ConversationGroupNameInput
import cc.lingya.xiaolingtong.ai.model.input.ConversationMessageSyncInput
import cc.lingya.xiaolingtong.ai.model.input.ConversationReadReceiptInput
import cc.lingya.xiaolingtong.ai.model.input.CreateAgentGoalInput
import cc.lingya.xiaolingtong.ai.model.input.EditAgentGoalInput
import cc.lingya.xiaolingtong.ai.model.input.ExcelSqlQueryResultPageInput
import cc.lingya.xiaolingtong.ai.model.input.SubagentTaskSyncInput
import cc.lingya.xiaolingtong.ai.model.input.UpdateConversationGroupInput
import cc.lingya.xiaolingtong.ai.model.input.WorkspaceFileListInput
import cc.lingya.xiaolingtong.ai.model.output.ActiveConversationsOutput
import cc.lingya.xiaolingtong.ai.model.output.AgentAsyncTaskOutput
import cc.lingya.xiaolingtong.ai.model.output.AgentAsyncTaskSyncOutput
import cc.lingya.xiaolingtong.ai.model.output.AgentGoalConfigOutput
import cc.lingya.xiaolingtong.ai.model.output.AgentGoalHistoryOutput
import cc.lingya.xiaolingtong.ai.model.output.AgentGoalOutput
import cc.lingya.xiaolingtong.ai.model.output.AgentGoalViewOutput
import cc.lingya.xiaolingtong.ai.model.output.AiChatEventsBatchOutput
import cc.lingya.xiaolingtong.ai.model.output.AiChatSubmissionOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationActivityOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationConfigOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationContextUsageOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationGroupDeletedOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationGroupOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationMessageOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationMessageSyncOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationMetadataOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationReadReceiptOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationTitleOutput
import cc.lingya.xiaolingtong.ai.model.output.ExcelSqlChartDatasetOutput
import cc.lingya.xiaolingtong.ai.model.output.ExcelSqlQueryResultPageOutput
import cc.lingya.xiaolingtong.ai.model.output.SubagentTaskOutput
import cc.lingya.xiaolingtong.ai.model.output.SubagentTaskResultOutput
import cc.lingya.xiaolingtong.ai.model.output.SubagentTaskSyncOutput
import cc.lingya.xiaolingtong.ai.model.output.UnreadConversationsOutput
import cc.lingya.xiaolingtong.ai.model.output.WorkspaceArtifactListOutput
import cc.lingya.xiaolingtong.ai.model.queue.AgentExecutorPayload
import cc.lingya.xiaolingtong.ai.model.queue.EnqueueAgentMessageRequest
import cc.lingya.xiaolingtong.ai.model.queue.QueuedAgentMessageContext
import cc.lingya.xiaolingtong.ai.model.queue.QueuedAgentMessageExecution
import cc.lingya.xiaolingtong.ai.model.queue.QueuedAgentMessageExecutionContext
import cc.lingya.xiaolingtong.ai.model_provider.model.ChatOptionsContext
import cc.lingya.xiaolingtong.ai.service.AgentExecutorAuthorizationScope
import cc.lingya.xiaolingtong.ai.service.AgentGoalRouteContext
import cc.lingya.xiaolingtong.ai.service.AgentGoalService
import cc.lingya.xiaolingtong.ai.service.AgentMessageQueueService
import cc.lingya.xiaolingtong.ai.service.AgentRequestConcurrencyService
import cc.lingya.xiaolingtong.ai.service.QueuedAgentMessageExecutor
import cc.lingya.xiaolingtong.auth.service.StudioExecutionPurposeAccess
import cc.lingya.xiaolingtong.common.transactional
import cc.lingya.xiaolingtong.common_util.context.execution.StudioExecutionPurposeContext
import cc.lingya.xiaolingtong.common_util.context.space.CollaborationSpaceContext
import cc.lingya.xiaolingtong.common_util.context.space.CollaborationSpaceInfo
import cc.lingya.xiaolingtong.common_util.context.tenant.TenantContext
import cc.lingya.xiaolingtong.common_util.exception.BadRequestException
import cc.lingya.xiaolingtong.common_util.exception.ConflictException
import cc.lingya.xiaolingtong.common_util.exception.ForbiddenException
import cc.lingya.xiaolingtong.common_util.exception.NotFoundException
import cc.lingya.xiaolingtong.common_util.exception.NotSupportedException
import cc.lingya.xiaolingtong.common_util.exception.UnauthorizedException
import cc.lingya.xiaolingtong.common_util.utils.MediaTypeFactory
import cc.lingya.xiaolingtong.common_util.utils.randomString
import cc.lingya.xiaolingtong.files.FileService
import cc.lingya.xiaolingtong.files.model.dto.input.CreateFileInput
import cc.lingya.xiaolingtong.files.model.dto.input.GeneratePreSignedUrlInput
import cc.lingya.xiaolingtong.files.model.dto.input.PreSignedUrlFileUploadResultInput
import cc.lingya.xiaolingtong.files.model.dto.output.FileExistsOutput
import cc.lingya.xiaolingtong.files.model.dto.output.FileOutput
import cc.lingya.xiaolingtong.files.model.dto.output.FileOutput.Companion.toFileOutput
import cc.lingya.xiaolingtong.files.model.dto.output.GeneratePreSignedUrlWriteOutput
import cc.lingya.xiaolingtong.files.model.dto.output.PreSignedUrlReadOutput
import cc.lingya.xiaolingtong.files.model.po.FilePo
import cc.lingya.xiaolingtong.knowledge.model.KnowledgeCitationType
import cc.lingya.xiaolingtong.knowledge.model.ReturnedReference
import cc.lingya.xiaolingtong.knowledge.model.dto.output.CitationMetadataOutput
import cc.lingya.xiaolingtong.oss.GeneratePreSignedUrlOptions
import cc.lingya.xiaolingtong.oss.HttpMethod
import jakarta.validation.Valid
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.Page
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.util.ClassUtils
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes
import org.springframework.web.servlet.HandlerMapping
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody
import java.nio.charset.StandardCharsets
import java.time.Duration

/**
 * 智能体控制器抽象基类
 *
 * 抽取与 [cc.lingya.xiaolingtong.ai.agents.Agents] 流式对话、订阅、中断及记忆查询的公共逻辑，
 * 子类仅需实现 [getAgents] 并指定 [@RequestMapping][org.springframework.web.bind.annotation.RequestMapping] 路径。
 *
 * @author 思追(shaco)
 */
@Transactional(propagation = Propagation.SUPPORTS)
abstract class AbstractAgentsController(
    chatUIEventStream: ChatUIEventStream,
) : AbstractAgentsConversationReadController(chatUIEventStream),
    QueuedAgentMessageExecutor {

    private companion object {

        const val MAX_ATTACHMENT_COUNT = 10
        const val MAX_ATTACHMENT_NAME_ATTEMPTS = 16
        const val ATTACHMENT_NAME_SUFFIX_LENGTH = 8

        /** 目标正文长度上限；与 `ai_agent_goal.objective` 列及创建目标接口的约束保持一致。 */
        const val MAX_GOAL_OBJECTIVE_LENGTH = 4000
    }

    @Autowired
    private var requestConcurrency: AgentRequestConcurrencyService? = null

    @Autowired
    protected lateinit var studioExecutionPurposeAccess: StudioExecutionPurposeAccess

    /** 外部宿主从已校验部署中解析真实 Agent；内部聊天不申请商业并发。 */
    protected open fun externalRequestAgentId(pathVariables: Map<String, String>): Long? = null

    @Autowired
    protected lateinit var workspaceInputFileService: WorkspaceInputFileService

    @Autowired
    protected lateinit var askUserQuestionStoreService: AskUserQuestionStoreService

    @Autowired
    protected lateinit var planApprovalStoreService: PlanApprovalStoreService

    @Autowired
    protected lateinit var fileService: FileService

    @Autowired
    protected lateinit var skillService: SkillService

    @Autowired
    protected lateinit var conversationActivityService: ConversationActivityService

    @Autowired
    protected lateinit var agentsConversationGroupService: AgentsConversationGroupService

    @Autowired
    protected lateinit var agentsStateMachineFactory: AgentsStateMachineFactory

    @Autowired
    protected lateinit var agentMessageQueueService: AgentMessageQueueService

    @Autowired
    protected lateinit var agentCollaborationService: AgentCollaborationService

    @Autowired
    protected lateinit var agentAsyncTaskService: AgentAsyncTaskService

    @Autowired
    protected lateinit var subagentTaskQueryService: SubagentTaskQueryService

    @Autowired
    protected lateinit var agentGoalService: AgentGoalService

    @Autowired
    protected lateinit var goalTransactionManager: PlatformTransactionManager

    /** 获取当前 HTTP 入口身份；OpenAPI 同时支持从持久队列上下文恢复。 */
    protected open fun currentRequestIdentity(): AgentsConversationIdentity? {
        val attributes =
            RequestContextHolder.getRequestAttributes()
                as? ServletRequestAttributes ?: return null
        val variables =
            attributes.request.getAttribute(
                HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE,
            )
                as? Map<*, *> ?: return null
        return parseAgentsIdentity(variables.entries.associate { it.key.toString() to it.value.toString() })
    }

    /** 审批与问答使用消息归属校验，不能仅凭交互 ID 操作。 */
    protected fun assertInteractionAccess(conversationId: String, messageId: String,) {
        currentRequestIdentity()?.let {
            agentsConversationService.assertMessagesBelongToConversation(it, conversationId, listOf(messageId))
        }
    }

    /** 入口可收紧上传附件的访问范围。 */
    protected open fun assertAttachmentAccess(fileId: Long) = Unit

    /** 入口可验证覆盖上传的目标资源。 */
    protected open fun beforeUploadUrl(input: GeneratePreSignedUrlInput) = Unit

    /** 入口可绑定已签发的上传凭据。 */
    protected open fun afterUploadUrl(output: GeneratePreSignedUrlWriteOutput) = Unit

    /** 入口可在确认上传前验证凭据归属。 */
    protected open fun beforeUploadConfirmation(input: PreSignedUrlFileUploadResultInput) = Unit

    /** 入口可持久化新文件的用户授权。 */
    protected open fun afterFileCreated(file: FilePo) = Unit

    /** 入口决定当前用户是否可复用已存在内容。 */
    protected open fun canReuseFile(contentMd5: String): Boolean = true

    /** 入口可限制知识引用的版本范围。 */
    protected open fun assertCitationAccess(references: List<ReturnedReference>) = Unit

    /**
     * 根据业务 id 与对话 id 获取智能体实例
     *
     * @param pathVariables 路径变量参数
     * @param conversationId 对话 id，非空
     * @param conversationIdSource 会话 ID 来源，底层可据此区分新建会话与历史会话
     * @return 智能体实例
     */
    protected abstract fun getAgents(
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        chatModelSpec: ChatModelSpec? = null,
    ): AgentHandle

    /**
     * 创建聊天 Agent，并返回本轮实际采用的模型配置。
     *
     * 默认实现适用于直接使用请求模型或当前默认模型的入口；运行时会忽略、冻结或规范化请求配置的入口应覆写本方法。
     */
    protected fun getAgentsForChat(
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        chatModelSpec: ChatModelSpec?,
    ): ResolvedChatAgents {
        val effectiveModel = chatModelSpec ?: getAgentsConfigContext(pathVariables).defaultModel as? ChatModelSpec
        return ResolvedChatAgents(
            handle =
            getAgents(
                pathVariables = pathVariables,
                conversationId = conversationId,
                conversationIdSource = conversationIdSource,
                chatModelSpec = chatModelSpec,
            ),
            chatModelSpec = effectiveModel,
        )
    }

    /** 在消息进入直接/队列分流前冻结宿主专属执行 binding；其他宿主保持无 binding。 */
    protected open fun prepareExecutionBinding(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        messageId: String,
        requestedChatModelSpec: ChatModelSpec?,
    ): AuthoringExecutionBinding? = null

    /** 显式恢复 Goal 前刷新创作 binding；普通宿主沿用原有恢复路由。 */
    protected open fun prepareGoalResumeBinding(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
    ): AuthoringExecutionBinding? = null

    /**
     * 获取智能体配置上下文
     */
    protected abstract fun getAgentsConfigContext(pathVariables: Map<String, String>): AgentsConfigContext

    /**
     * 提供当前对话执行期间统一生效的智能体选项。
     *
     * 默认关闭所有调试旁路；需要开启的业务入口必须显式覆写，避免生产对话被隐式采集。
     */
    protected open fun getAgentOptions(pathVariables: Map<String, String>, input: AiChatInput,): AgentOptions =
        AgentOptions(planMode = input.planMode)

    /**
     * 根据宿主已经授权的模型引用构建安全展示目录；每个宿主必须明确提供自己的授权来源。
     */
    protected abstract fun getModelKeyGroupOutputs(
        pathVariables: Map<String, String>,
        context: AgentsConfigContext,
    ): List<ModelKeyGroupOutput>

    /**
     * 查询智能体配置信息
     *
     * 返回可用模型列表和当前默认模型标识，前端通过匹配模型条目获取能力信息。
     */
    @GetMapping("/config")
    fun getAgentsConfig(@PathVariable pathVariables: Map<String, String>,): AgentsConfigOutput {
        val context = getAgentsConfigContext(pathVariables)

        val supportAttachmentExt = resolveAttachmentExt(context)

        val modelKeyGroups = getModelKeyGroupOutputs(pathVariables, context)

        return AgentsConfigOutput(
            modelConfig =
            ModelConfigOutput(
                defaultModel =
                context.defaultModel?.let {
                    DefaultModelOutput(
                        keyGroupId = it.keyGroupId,
                        model = it.model,
                    )
                },
                modelKeyGroups = modelKeyGroups,
            ),
            supportAttachmentExt = supportAttachmentExt,
            maxAttachmentCount = MAX_ATTACHMENT_COUNT,
            goal =
            AgentGoalConfigOutput(
                supported = true,
                continuationEnabled = true,
            ),
        )
    }

    /**
     * 获取指定会话的运行配置。
     *
     * 返回最后一条用户消息使用的模型和已经生效的计划模式；历史模型缺失时回退到 Agent 默认模型。
     */
    @GetMapping("/conversations/{conversationId}/config")
    fun getConversationConfig(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
    ): ConversationConfigOutput {
        val identity = parseAgentsIdentity(pathVariables)
        val lastChatModelSpec =
            agentsConversationService.getLastChatModelSpec(identity, conversationId)
                ?: (getAgentsConfigContext(pathVariables).defaultModel as? ChatModelSpec)
        return ConversationConfigOutput(
            lastChatModelSpec = lastChatModelSpec,
            planMode = agentsConversationService.getPlanMode(identity, conversationId),
        )
    }

    /**
     * 创建新会话
     *
     * 生成 conversationId 并返回给前端，后续对话请使用 [continueChat]。
     */
    @PostMapping
    fun createChatStream(
        @PathVariable pathVariables: Map<String, String>,
        @Valid @RequestBody input: AiChatInput,
    ): AiChatSubmissionOutput {
        val conversationId = SessionMessageHelper.generateConversationId()
        return doChat(
            pathVariables = pathVariables,
            conversationId = conversationId,
            conversationIdSource = ConversationIdSource.GENERATED,
            input = input,
        )
    }

    /**
     * 继续已有会话聊天（conversationId 在 URL path 中）
     */
    @PostMapping("/conversations/{conversationId}")
    fun continueChat(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: AiChatInput,
    ): AiChatSubmissionOutput = doChat(
        pathVariables = pathVariables,
        conversationId = conversationId,
        conversationIdSource = ConversationIdSource.HISTORY,
        input = input,
    )

    /**
     * 接纳一条用户消息，并在直接执行与持久排队之间完成统一调度。
     *
     * 空闲会话优先调用 [executeChat]，避免每条正常消息都产生队列记录。已有活动执行或历史积压时，
     * 消息通过 [submitQueuedMessage] 保存为 `QUEUED`，由前一条消息结束事件启动。预检查与真正获取
     * 会话执行租约之间仍可能出现并发，因此这里还捕获 `conversation.execution.running`，将竞争失败的
     * 直接执行安全地降级为持久排队。其他业务冲突必须继续抛出，不能被误判为排队条件。
     *
     * 历史会话会在创建 Agent 或写入队列前校验身份归属，保证直接执行和排队执行使用相同的访问边界。
     *
     * `goalMode=true` 的消息在接纳阶段创建目标：排队期间控制面即可查询到目标，执行路由与聊天入口一致。
     *
     * @param conversationIdSource 会话 ID 来源；历史会话必须已存在且属于当前 Agent 身份
     * @return 服务端接纳后的权威消息 ID、调度结果和公开状态
     */
    protected fun doChat(
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        input: AiChatInput,
    ): AiChatSubmissionOutput {
        assertChatInputModes(input)
        if (input.files.orEmpty().size > MAX_ATTACHMENT_COUNT) {
            throw BadRequestException(
                "ai.chat.attachment_count_exceeded",
                "单条消息的附件数量不能超过 $MAX_ATTACHMENT_COUNT 个",
            )
        }
        val identityMo = parseAgentsIdentity(pathVariables)
        if (conversationIdSource == ConversationIdSource.HISTORY) {
            agentsConversationService.assertConversationBelongsToIdentity(identityMo, conversationId)
        }
        input.files.orEmpty().forEach { assertAttachmentAccess(it.id) }
        val userMessage = buildUserMessage(conversationId, input)
        val agentOptions = getAgentOptions(pathVariables, input).copy(planMode = input.planMode)

        val messageId = SessionMessageHelper.generateMessageId()
        val submission =
            requestConcurrency?.prepare(externalRequestAgentId(pathVariables), conversationId, messageId)
                ?: AgentRequestSubmission(conversationId, messageId, null)
        try {
            return AgentRequestSubmissionContext.runWithContext(submission) {
                val binding = prepareExecutionBinding(
                    pathVariables = pathVariables,
                    identity = identityMo,
                    conversationId = conversationId,
                    conversationIdSource = conversationIdSource,
                    messageId = messageId,
                    requestedChatModelSpec = input.chatModelSpec,
                )
                binding?.let { requireBindingSource(it, pathVariables, conversationId) }
                val authoringPayload = binding?.let {
                    buildQueuedControllerPayload(
                        pathVariables = pathVariables,
                        requestedChatModelSpec = it.effectiveModel,
                        agentOptions = agentOptions,
                        authoringBinding = it,
                    )
                }
                // 目标必须在消息被接纳前建立：直接执行与排队恢复都不会再创建第二个目标。
                if (input.goalMode == true) {
                    createGoalForMessage(
                        pathVariables = pathVariables,
                        conversationId = conversationId,
                        conversationIdSource = conversationIdSource,
                        objective = input.query,
                        executorPayload = authoringPayload,
                    )
                }
                // 已有积压时即使租约短暂空闲也必须继续排队，否则新消息可能越过已接纳的队首。
                if (agentMessageQueueService.shouldQueueNewMessage(conversationId)) {
                    return@runWithContext submitQueuedMessage(
                        pathVariables = pathVariables,
                        identity = identityMo,
                        conversationId = conversationId,
                        input = input,
                        userMessage = userMessage,
                        agentOptions = agentOptions,
                        executorPayload = authoringPayload,
                    )
                }

                val executeDirect = {
                    executeChat(
                        identity = identityMo,
                        pathVariables = pathVariables,
                        conversationId = conversationId,
                        conversationIdSource = conversationIdSource,
                        requestedChatModelSpec = binding?.effectiveModel ?: input.chatModelSpec,
                        agentOptions = agentOptions,
                        userMessage = userMessage,
                        authoringBinding = binding,
                        executorPayloadOverride = authoringPayload,
                    )
                }
                val response =
                    try {
                        if (binding == null) {
                            executeDirect()
                        } else {
                            AgentExecutorAuthorizationScope(studioExecutionPurposeAccess)
                                .runWithContext(requireNotNull(authoringPayload), executeDirect)
                        }
                    } catch (error: ConflictException) {
                        // 预检查不是原子门禁；只有租约冲突可以转为排队，避免吞掉权限或资源状态冲突。
                        if (error.businessMessage.getCode() == "conversation.execution.running") {
                            return@runWithContext submitQueuedMessage(
                                pathVariables = pathVariables,
                                identity = identityMo,
                                conversationId = conversationId,
                                input = input,
                                userMessage = userMessage,
                                agentOptions = agentOptions,
                                executorPayload = authoringPayload,
                            )
                        }
                        throw error
                    }
                AiChatSubmissionOutput(
                    conversationId = response.conversationId,
                    messageId = response.messageId,
                    disposition = AgentMessageDispatchDisposition.STARTED,
                    status = ConversationMessageStatus.PENDING,
                )
            }
        } finally {
            requestConcurrency?.cancel(submission)
        }
    }

    /** 校验本条消息的模式组合；计划模式与目标模式互斥，不能在同一条消息上同时开启。 */
    private fun assertChatInputModes(input: AiChatInput) {
        if (input.planMode == true && input.goalMode == true) {
            throw BadRequestException(
                "ai.chat.mode_conflict",
                "计划模式与目标模式不能同时开启",
            )
        }
    }

    /**
     * 以本条人类消息正文创建一个新目标。
     *
     * 创建发生在消息接纳阶段：排队期间控制面即可查询到目标，恢复执行时也不会重复创建。
     * 新会话先建立会话再创建目标，避免出现找不到所属会话的当前目标；两步同事务，
     * 创建失败时不会遗留空会话。执行路由复用聊天入口，目标轮才能跨实例回到同一入口。
     *
     * 目标领域仍按既有规则裁决：只有已完成的目标可以被替换，未完成目标返回冲突。
     */
    private fun createGoalForMessage(
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        objective: String,
        executorPayload: AgentExecutorPayload?,
    ) {
        if (objective.length > MAX_GOAL_OBJECTIVE_LENGTH) {
            throw BadRequestException(
                "ai.agent_goal.objective_too_long",
                "目标内容长度不能超过 $MAX_GOAL_OBJECTIVE_LENGTH",
            )
        }
        val goalInput = CreateAgentGoalInput(objective = objective)
        transactional(transactionManager = goalTransactionManager) {
            if (conversationIdSource == ConversationIdSource.GENERATED) {
                prepareGoalConversation(pathVariables, conversationId, goalInput)
            }
            AgentGoalRouteContext.runWithContext(
                AgentGoalExecutionRoute(
                    executorKey = executorKey(),
                    executorPayload = executorPayload ?: buildQueuedControllerPayload(
                        pathVariables = pathVariables,
                        requestedChatModelSpec = null,
                        agentOptions = AgentOptions(),
                    ),
                ),
            ) {
                agentGoalService.create(conversationId, goalInput)
            }
        }
    }

    /**
     * 在一次消息真正开始初始化前执行入口专属副作用。
     *
     * 排队消息会在认领它的实例调用该钩子，因此跨实例路由等状态不会提前写到接纳请求所在实例。
     */
    protected open fun beforeChatExecution(pathVariables: Map<String, String>, conversationId: String,) = Unit

    /**
     * 使用 Spring 代理背后的 Controller 类名作为持久执行器键。
     *
     * 队列可能由另一实例或重启后的进程恢复，不能保存 Bean 引用或临时对象标识；具体 Controller 类名
     * 在各实例间一致，并能让执行器注册表找回同类聊天入口。
     */
    override fun executorKey(): String = ClassUtils.getUserClass(this).name

    /**
     * 从持久化命令恢复当前 Controller 的一次标准流式执行。
     *
     * 恢复时重新解析 Agent 身份并校验会话和附件，不能沿用消息入队时的授权结论。队列上下文固定复用
     * 已公开的 `messageId`，使 Agent 初始化只激活原有 `QUEUED` 消息，而不会插入第二条用户消息。
     * [executeChat] 返回时仅表示流初始化完成；最终完成由会话执行租约事件统一推进队列。
     */
    override fun executeQueuedMessage(execution: QueuedAgentMessageExecution) {
        val command = execution.executorPayload
        val snapshot = command.subagent
        if (execution.executionType == AgentExecutionType.SUBAGENT_ASYNC_EXECUTION) {
            requireNotNull(snapshot) { "后台子任务缺少快照" }
            require(
                snapshot.childConversationId == execution.conversationId &&
                    snapshot.childMessageId == execution.messageId,
            ) { "子任务快照与队列不一致" }
            require(command.collaboration == null) { "一次性子任务不能携带协作描述" }
            SubagentExecutionContext.runWithContext(snapshot) {
                executeQueuedMessageInContext(execution, collaboration = null)
            }
        } else {
            require(snapshot == null) { "普通执行不能携带子任务快照" }
            val parentIdentity = parseAgentsIdentity(command.pathVariables)
            val collaboration =
                if (command.collaboration != null ||
                    execution.executionType == AgentExecutionType.COLLABORATION_TURN
                ) {
                    agentCollaborationService
                        .authorizeQueuedExecution(
                            tenantId = execution.tenantId,
                            conversationId = execution.conversationId,
                            messageId = execution.messageId,
                            reference = command.collaboration,
                            identity = parentIdentity,
                        )?.copy(parentMessageId = execution.parentMessageId)
                } else {
                    null
                }
            require(command.collaboration == null || collaboration != null) {
                "协作恢复载荷没有通过服务端授权"
            }
            executeQueuedMessageInContext(execution, collaboration)
        }
    }

    private fun executeQueuedMessageInContext(
        execution: QueuedAgentMessageExecution,
        collaboration: CollaborationExecutionDescriptor?,
    ) {
        val command = execution.executorPayload
        val parentIdentity = parseAgentsIdentity(command.pathVariables)
        val identity =
            if (command.subagent != null || collaboration != null) {
                object : AgentsConversationIdentity by parentIdentity {

                    override val conversationType = SUBAGENT
                }
            } else {
                parentIdentity
            }
        agentsConversationService.assertConversationBelongsToIdentity(identity, execution.conversationId)
        validateQueuedAttachments(execution.userMessage)
        if (requestConcurrency != null && execution.executionType == AgentExecutionType.USER_MESSAGE &&
            externalRequestAgentId(command.pathVariables) != null
        ) {
            requestConcurrency?.requireContinuation(execution.conversationId, execution.messageId)
        }
        val executeChat = {
            executeChat(
                identity = identity,
                pathVariables = command.pathVariables,
                conversationId = execution.conversationId,
                conversationIdSource = ConversationIdSource.HISTORY,
                requestedChatModelSpec = command.requestedChatModelSpec,
                agentOptions = command.agentOptions,
                userMessage = execution.userMessage,
                collaboration = collaboration,
                executorPayloadOverride = command,
                authoringBinding = command.authoringBinding,
            )
        }
        val spaceId = command.pathVariables["spaceId"]?.toLongOrNull()
        val executeInSpace =
            if (spaceId == null) {
                executeChat
            } else {
                {
                    CollaborationSpaceContext.runWithContext(
                        CollaborationSpaceInfo(TenantContext.getTenantId(), spaceId),
                        executeChat,
                    )
                }
            }
        QueuedAgentMessageContext.runWithContext(
            QueuedAgentMessageExecutionContext(
                queueId = execution.queueId,
                messageId = execution.messageId,
                executionType = execution.executionType,
                parentMessageId = execution.parentMessageId,
                agentExecutionKey = execution.agentExecutionKey,
                dispatchMode = execution.dispatchMode,
            ),
            { AgentExecutorAuthorizationScope(studioExecutionPurposeAccess).runWithContext(command, executeInSpace) },
        )
        if (collaboration != null) {
            agentCollaborationService.markRunStarted(execution.tenantId, collaboration.agentId, execution.messageId)
        }
    }

    /**
     * 把入口相关的不可推导参数固化为可跨实例恢复的命令。
     *
     * 用户正文和附件保存在公开消息中；路径变量、显式模型和 Agent 选项保存在执行器 payload 中。
     * 两部分共同构成提交时快照，避免恢复时读取接纳节点的内存状态。
     */
    private fun submitQueuedMessage(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
        input: AiChatInput,
        userMessage: UserMessage,
        agentOptions: AgentOptions,
        executorPayload: AgentExecutorPayload?,
    ): AiChatSubmissionOutput {
        val messageId = AgentRequestSubmissionContext.getOrNull()?.messageId ?: SessionMessageHelper.generateMessageId()
        val requestedModel = executorPayload?.requestedChatModelSpec ?: input.chatModelSpec
        val payload = executorPayload ?: buildQueuedControllerPayload(
            pathVariables = pathVariables,
            requestedChatModelSpec = requestedModel,
            agentOptions = agentOptions,
        )
        return agentMessageQueueService.submit(
            EnqueueAgentMessageRequest(
                identity = identity,
                conversationId = conversationId,
                messageId = messageId,
                userMessage = userMessage,
                requestedChatModelSpec = requestedModel,
                executorKey = executorKey(),
                executorPayload = payload,
            ),
        )
    }

    /**
     * 在完整请求上下文中启动一次标准 Agent 流式执行。
     *
     * 直接提交和队列恢复共用本方法，保证模型解析、入口副作用及上下文绑定没有两套实现。
     */
    private fun executeChat(
        identity: AgentsConversationIdentity,
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        requestedChatModelSpec: ChatModelSpec?,
        agentOptions: AgentOptions,
        userMessage: UserMessage,
        collaboration: CollaborationExecutionDescriptor? = null,
        executorPayloadOverride: AgentExecutorPayload? = null,
        authoringBinding: AuthoringExecutionBinding? = executorPayloadOverride?.authoringBinding,
    ): AiChatStreamResponse {
        authoringBinding?.let { requireBindingSource(it, pathVariables, conversationId) }
        val resolve = {
            resolveChatAgents(
                identity = identity,
                pathVariables = pathVariables,
                conversationId = conversationId,
                conversationIdSource = conversationIdSource,
                chatModelSpec = requestedChatModelSpec,
            )
        }
        val resolvedAgents =
            if (authoringBinding == null) {
                resolve()
            } else {
                AuthoringExecutionBindingContext.runWithContext(authoringBinding, resolve)
            }
        val handle =
            try {
                when {
                    SubagentExecutionContext.getOrNull() != null -> {
                        RestoredSubagentHandle(
                            resolvedAgents.handle,
                            requireNotNull(SubagentExecutionContext.getOrNull()),
                        )
                    }

                    collaboration != null -> {
                        RestoredCollaborationHandle(resolvedAgents.handle, collaboration)
                    }

                    else -> {
                        resolvedAgents.handle
                    }
                }
            } catch (error: Throwable) {
                resolvedAgents.handle.close()
                throw error
            }
        return AgentHandleExecution(handle).execute { agent ->
            beforeChatExecution(pathVariables, conversationId)
            val executionRoute =
                AgentAsyncTaskExecutionRoute(
                    executorKey = executorKey(),
                    // 异步完成通知必须恢复任务创建时实际使用的模型，不能在未来重新解析可能已经变化的默认模型。
                    executorPayload =
                    executorPayloadOverride ?: buildQueuedControllerPayload(
                        pathVariables = pathVariables,
                        requestedChatModelSpec = resolvedAgents.chatModelSpec,
                        agentOptions = agentOptions,
                        authoringBinding = authoringBinding,
                    ),
                )
            AgentAsyncTaskExecutionContext.runWithContext(executionRoute) {
                AgentsConversationIdentityContext.runWithContext(identity) {
                    EffectiveChatModelSpecContext.runWithContext(resolvedAgents.chatModelSpec) {
                        ChatOptionsContext.runWithContext(requestedChatModelSpec) {
                            AgentOptionsContext.runWithContext(agentOptions) {
                                // 目标领域需要知道可恢复的执行入口，才能在创建后跨实例唤醒目标轮。
                                // 这里复用同一条执行路由，避免出现第二份路由定义。
                                AgentGoalRouteContext.runWithContext(
                                    AgentGoalExecutionRoute(
                                        executorKey = executionRoute.executorKey,
                                        executorPayload = executionRoute.executorPayload,
                                    ),
                                ) {
                                    if (authoringBinding == null) {
                                        agent.chatStream(userMessage)
                                    } else {
                                        AuthoringExecutionBindingContext.runWithContext(authoringBinding) {
                                            agent.chatStream(userMessage)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /** 将标准 Controller 的不可推导参数编码为跨实例恢复载荷。 */
    private fun buildQueuedControllerPayload(
        pathVariables: Map<String, String>,
        requestedChatModelSpec: ChatModelSpec?,
        agentOptions: AgentOptions,
        authoringBinding: AuthoringExecutionBinding? = null,
    ): AgentExecutorPayload = AgentExecutorPayload(
        pathVariables = pathVariables,
        requestedChatModelSpec = requestedChatModelSpec,
        agentOptions = agentOptions,
        studioPurpose = StudioExecutionPurposeContext.getOrNull(),
        authoringBinding = authoringBinding,
    )

    /**
     * 目标控制面的会话级鉴权。
     *
     * 默认实现即安全默认：用既有 [currentRequestIdentity] 做会话归属校验，无身份直接拒绝。
     * 各宿主可覆写以收紧（租户、应用访问、资源 execute 权限、渠道启用、外部身份）。
     *
     * 与 [assertInteractionAccess] 的区别：目标查询与创建不天然关联某条消息，
     * 因此不能复用只接受 messageId 的既有方法。
     */
    protected open fun assertGoalAccess(conversationId: String) {
        val identity =
            currentRequestIdentity()
                ?: throw UnauthorizedException("ai.agent_goal.unauthenticated", "未认证")
        agentsConversationService.assertConversationBelongsToIdentity(identity, conversationId)
    }

    private fun requireBindingSource(
        binding: AuthoringExecutionBinding,
        pathVariables: Map<String, String>,
        conversationId: String,
    ) {
        val pathSpaceId = pathVariables["spaceId"]?.toLongOrNull()
        if (binding.conversationId != conversationId || binding.tenantId != TenantContext.getTenantId() ||
            binding.spaceId != pathSpaceId
        ) {
            throw ForbiddenException("ai.authoring.binding.scope-mismatch", "创作执行目标与冻结能力不一致")
        }
        val purpose = StudioExecutionPurposeContext.getOrNull()
            ?: throw ForbiddenException("ai.authoring.binding.origin-missing", "创作执行缺少原始用途授权")
        if (!binding.executionOrigin.matches(purpose)) {
            throw ForbiddenException("ai.authoring.binding.origin-mismatch", "创作执行来源与冻结能力不一致")
        }
    }

    /** 在目标事务内预建宿主会话；宿主可补齐业务资料与能力修订。 */
    protected open fun prepareGoalConversation(
        pathVariables: Map<String, String>,
        conversationId: String,
        input: CreateAgentGoalInput,
    ) {
        agentsConversationService.preCreateConversation(
            parseAgentsIdentity(pathVariables),
            conversationId,
            input.objective,
        )
    }

    /** 查询当前目标；没有目标时返回空结果而不是 404。 */
    @GetMapping("/conversations/{conversationId}/goal")
    fun getGoal(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
    ): AgentGoalViewOutput {
        assertGoalAccess(conversationId)
        return agentGoalService.findCurrent(conversationId)
    }

    /** 查询目标历史。 */
    @GetMapping("/conversations/{conversationId}/goal/history")
    fun getGoalHistory(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): AgentGoalHistoryOutput {
        assertGoalAccess(conversationId)
        return agentGoalService.findHistory(conversationId, page, size)
    }

    /** 编辑目标；不改变相位与激活状态。 */
    @PatchMapping("/conversations/{conversationId}/goal")
    fun editGoal(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: EditAgentGoalInput,
    ): AgentGoalOutput {
        assertGoalAccess(conversationId)
        return agentGoalService.edit(conversationId, input)
    }

    /** 暂停目标并撤销自动续跑授权。 */
    @PostMapping("/conversations/{conversationId}/goal/pause")
    fun pauseGoal(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: AgentGoalRefInput,
    ): AgentGoalOutput {
        assertGoalAccess(conversationId)
        return agentGoalService.pause(conversationId, input)
    }

    /** 恢复目标并重新授予自动续跑授权。 */
    @PostMapping("/conversations/{conversationId}/goal/resume")
    fun resumeGoal(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: AgentGoalRefInput,
    ): AgentGoalOutput {
        assertGoalAccess(conversationId)
        val identity = parseAgentsIdentity(pathVariables)
        val binding = prepareGoalResumeBinding(pathVariables, identity, conversationId)
        return agentGoalService.resume(conversationId, input, binding)
    }

    /** 清除目标并保留墓碑。 */
    @PostMapping("/conversations/{conversationId}/goal/clear")
    fun clearGoal(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: AgentGoalRefInput,
    ): AgentGoalOutput {
        assertGoalAccess(conversationId)
        return agentGoalService.clear(conversationId, input)
    }

    /**
     * 中断已有会话的聊天流（conversationId 在 URL path 中）
     */
    @DeleteMapping("/conversations/{conversationId}/interrupt")
    open fun interruptByConversation(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
    ) {
        val identity = parseAgentsIdentity(pathVariables)
        assertConversationInterruptAccess(pathVariables, identity, conversationId)
        agentsConversationService.assertConversationBelongsToIdentity(identity, conversationId)
        agentsStateMachineFactory.forConversation(conversationId).interrupt(CancelReason.USER_INTERRUPT)
    }

    /** 允许宿主在共享会话归属校验前补充业务资源检查，不加载 Agent 配置。 */
    protected open fun assertConversationInterruptAccess(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
    ) = Unit

    /**
     * 压缩已有会话的上下文。
     */
    @PostMapping("/conversations/{conversationId}/compact")
    fun compactByConversation(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @RequestParam(defaultValue = "true") force: Boolean,
    ) {
        resolveHistoryAgents(pathVariables, conversationId).use {
            it.agent.compact(force)
        }
    }

    /**
     * 获取当前会话视图的模型上下文使用量。
     *
     * 前端可在手动压缩完成后，或轮询会话状态时调用此接口刷新上下文占用；
     * 该接口不依赖新的用户消息，也不会修改会话内容。
     * 已创建但尚无消息的会话返回零占用和零比例，不装配 Agent 或解析模型窗口。
     */
    @GetMapping("/conversations/{conversationId}/context-usage")
    fun getConversationContextUsage(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
    ): ConversationContextUsageOutput {
        val identity = parseAgentsIdentity(pathVariables)
        val messages = agentsConversationService.getMessages(
            identity,
            conversationId,
            AgentsMessageListInput().also {
                it.current = 0
                it.size = 1
            },
        )
        // 消息查询先校验会话归属；尚未开始对话时按零占用展示，不要求配置默认模型。
        if (messages.isEmpty) {
            return ConversationContextUsageOutput(
                systemPromptTokens = 0,
                sessionMessageTokens = 0,
                maxContextTokens = 0,
                activeUsageRatio = 0.0,
                requiredUsageRatio = 0.0,
            )
        }
        return resolveAgents(
            identity = identity,
            pathVariables = pathVariables,
            conversationId = conversationId,
            conversationIdSource = ConversationIdSource.HISTORY,
            chatModelSpec = null,
        ).use {
            it.agent.getCurrentContextUsage()
        }
    }

    /** 按页读取当前身份下可见的主会话。 */
    @GetMapping("/conversations")
    fun getConversations(
        @PathVariable pathVariables: Map<String, String>,
        @Valid input: AgentsConversationPageInput,
    ): Any {
        val identity = parseAgentsIdentity(pathVariables)
        return doGetConversations(pathVariables, identity, input)
    }

    /** 读取当前身份下单条主会话摘要，供会话深链接恢复使用。 */
    @GetMapping("/conversations/{conversationId}")
    fun getConversationSummary(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
    ): Any {
        val identity = parseAgentsIdentity(pathVariables)
        return doGetConversationSummary(pathVariables, identity, conversationId)
    }

    /** 构造当前入口的分页会话响应；扩展宿主可以保留自己的会话输出字段。 */
    protected open fun doGetConversations(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        input: AgentsConversationPageInput,
    ): Any = agentsConversationService.getConversationPage(identity, input)

    /** 构造当前入口的单条会话摘要；扩展宿主可以保留自己的会话输出字段。 */
    protected open fun doGetConversationSummary(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
    ): Any = agentsConversationService.getConversationSummary(identity, conversationId)

    /** 一次性读取当前身份作用域下的完整分组目录。 */
    @GetMapping("/conversation-groups")
    fun getConversationGroups(@PathVariable pathVariables: Map<String, String>): List<ConversationGroupOutput> =
        agentsConversationGroupService.list(parseAgentsIdentity(pathVariables))

    /** 创建当前身份作用域下的会话分组。 */
    @PostMapping("/conversation-groups")
    fun createConversationGroup(
        @PathVariable pathVariables: Map<String, String>,
        @Valid @RequestBody input: ConversationGroupNameInput,
    ): ConversationGroupOutput = agentsConversationGroupService.create(
        parseAgentsIdentity(pathVariables),
        input,
    )

    /** 重命名当前身份作用域下的会话分组。 */
    @PatchMapping("/conversation-groups/{groupId}")
    fun renameConversationGroup(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable groupId: Long,
        @Valid @RequestBody input: ConversationGroupNameInput,
    ): ConversationGroupOutput = agentsConversationGroupService.rename(
        parseAgentsIdentity(pathVariables),
        groupId,
        input,
    )

    /** 删除分组并将其会话移回未分组。 */
    @DeleteMapping("/conversation-groups/{groupId}")
    fun deleteConversationGroup(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable groupId: Long,
    ): ConversationGroupDeletedOutput = agentsConversationGroupService.delete(
        parseAgentsIdentity(pathVariables),
        groupId,
    )

    /** 移动主会话；请求必须显式提供 groupId，null 表示移回未分组。 */
    @PatchMapping("/conversations/{conversationId}/group")
    fun moveConversationToGroup(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: UpdateConversationGroupInput,
    ): ConversationMetadataOutput {
        val identity = parseAgentsIdentity(pathVariables)
        requireConversationMetadataWritable(pathVariables, identity, conversationId)
        return agentsConversationGroupService.move(identity, conversationId, input.groupId)
    }

    /** 宿主可以在通用元数据写入前补充其独立会话所有权校验。 */
    protected open fun requireConversationMetadataWritable(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
    ) = Unit

    /** 返回当前 Agent 身份下尚未结束执行的全部会话 ID。 */
    @GetMapping("/conversations/active")
    fun getActiveConversations(@PathVariable pathVariables: Map<String, String>,): ActiveConversationsOutput =
        ActiveConversationsOutput(
            conversationActivityService.getUnfinishedConversationIds(parseAgentsIdentity(pathVariables)),
        )

    /** 返回当前 Agent 身份下存在未读终态用户消息的全部会话 ID。 */
    @GetMapping("/conversations/unread")
    fun getUnreadConversations(@PathVariable pathVariables: Map<String, String>,): UnreadConversationsOutput =
        UnreadConversationsOutput(
            conversationActivityService.getUnreadConversationIds(parseAgentsIdentity(pathVariables)),
        )

    /** 批量返回当前 Agent 身份下根会话的执行状态与未读完成结果。 */
    @PostMapping("/conversations/activity/query")
    @ResponseStatus(HttpStatus.OK)
    fun getConversationActivities(
        @PathVariable pathVariables: Map<String, String>,
        @Valid @RequestBody input: ConversationActivityBatchInput,
    ): List<ConversationActivityOutput> = conversationActivityService.getActivities(
        identity = parseAgentsIdentity(pathVariables),
        conversationIds = input.conversationIds,
    )

    /** 将当前 Agent 身份下根会话的已读游标推进到指定终态用户消息。 */
    @PutMapping("/conversations/{conversationId}/read-receipt")
    fun markConversationRead(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: ConversationReadReceiptInput,
    ): ConversationReadReceiptOutput = conversationActivityService
        .markRead(
            identity = parseAgentsIdentity(pathVariables),
            conversationId = conversationId,
            messageId = input.messageId,
        ).let { activity ->
            ConversationReadReceiptOutput(
                conversationId = activity.conversationId,
                executionStatus = activity.executionStatus,
                activeMessageId = activity.activeMessageId,
                executionEpoch = activity.executionEpoch,
                executionStartedTime = activity.executionStartedTime,
                latestTerminalMessageId = activity.latestTerminalMessageId,
                latestTerminalTime = activity.latestTerminalTime,
                hasUnreadCompletion = activity.hasUnreadCompletion,
            )
        }

    /**
     * 获取对话会话统计信息
     */
    @GetMapping("/conversations/stats")
    fun getConversationStats(@PathVariable pathVariables: Map<String, String>,): Any {
        val identityMo = parseAgentsIdentity(pathVariables)
        return doGetConversationStats(pathVariables, identityMo)
    }

    /**
     * 构造当前业务入口的会话统计响应。
     *
     * 默认返回标准 AI 会话统计；具有独立统计口径的入口可返回自己的响应类型。
     */
    protected fun doGetConversationStats(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
    ): Any = agentsConversationService.getConversationStats(identity)

    /**
     * 返回当前 Agent 身份下会话的权威标题及生成状态。
     *
     * 客户端可独立轮询该轻量接口，不需要等待回答流结束或重复获取完整会话列表。
     */
    @GetMapping("/conversations/{conversationId}/title")
    fun getConversationTitle(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
    ): ConversationTitleOutput {
        val identity = parseAgentsIdentity(pathVariables)
        return agentsConversationService.getConversationTitle(identity, conversationId)
    }

    /**
     * 更新会话标题
     */
    @PatchMapping("/conversations/{conversationId}/title")
    fun updateConversationTitle(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: AgentsConversationTitleInput,
    ): ConversationMetadataOutput {
        val identity = parseAgentsIdentity(pathVariables)
        requireConversationMetadataWritable(pathVariables, identity, conversationId)
        return agentsConversationService.updateConversationTitle(identity, conversationId, input)
    }

    /**
     * 更新会话状态
     */
    @PatchMapping("/conversations/{conversationId}/status")
    fun updateConversationStatus(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid @RequestBody input: AgentsConversationStatusInput,
    ) {
        val identityMo = parseAgentsIdentity(pathVariables)
        agentsConversationService.updateConversationStatus(identityMo, conversationId, input)
    }

    /**
     * 删除会话
     */
    @DeleteMapping("/conversations/{conversationId}")
    fun deleteConversation(@PathVariable pathVariables: Map<String, String>, @PathVariable conversationId: String,) {
        val identityMo = parseAgentsIdentity(pathVariables)
        doDeleteConversation(pathVariables, identityMo, conversationId)
    }

    /**
     * 执行当前业务入口的会话删除语义。
     *
     * 默认使用标准 AI 删除；具有独立会话生命周期的入口可覆写并保持同一路由契约。
     */
    protected fun doDeleteConversation(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
    ) {
        agentsConversationService.deleteConversation(identity, conversationId)
    }

    /** 分页获取 SQL 查询结果。 */
    @GetMapping("/conversations/{conversationId}/sql-query-results/{resultId}")
    fun getSqlQueryResult(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable resultId: String,
        @Valid input: ExcelSqlQueryResultPageInput,
    ): ExcelSqlQueryResultPageOutput = getSqlQueryResult(
        identity = parseAgentsIdentity(pathVariables),
        conversationId = conversationId,
        resultId = resultId,
        input = input,
    )

    /** 获取 SQL 查询结果的类型化图表数据。 */
    @GetMapping("/conversations/{conversationId}/sql-query-results/{resultId}/chart-data")
    fun getSqlQueryChartData(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable resultId: String,
    ): ResponseEntity<ExcelSqlChartDatasetOutput> = getSqlQueryChartData(
        parseAgentsIdentity(pathVariables),
        conversationId,
        resultId,
    )

    /** 导出指定会话下的完整 SQL 查询结果。 */
    @GetMapping("/conversations/{conversationId}/sql-query-results/{resultId}/export")
    fun exportSqlQueryResult(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable resultId: String,
        @RequestParam format: SqlQueryResultExportFormat,
        @RequestHeader(name = HttpHeaders.ACCEPT, required = false) acceptedMediaTypes: List<MediaType>?,
    ): ResponseEntity<StreamingResponseBody> = exportSqlQueryResult(
        identity = parseAgentsIdentity(pathVariables),
        conversationId = conversationId,
        resultId = resultId,
        format = format,
        acceptedMediaTypes = acceptedMediaTypes,
    )

    /** 获取会话下的消息列表。 */
    @GetMapping("/conversations/{conversationId}/messages")
    fun getConversationMessages(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid input: AgentsMessageListInput,
    ): Page<ConversationMessageOutput> = readConversationMessages(
        parseAgentsIdentity(pathVariables),
        conversationId,
        input,
    )

    /** 查询新创建的公开消息，包含目标轮和人工回应消息。 */
    @GetMapping("/conversations/{conversationId}/messages/sync")
    fun syncConversationMessages(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid input: ConversationMessageSyncInput,
    ): ConversationMessageSyncOutput {
        val candidates =
            agentsConversationService.getNewMessages(
                identity = parseAgentsIdentity(pathVariables),
                conversationId = conversationId,
                afterMessageId = input.afterMessageId,
                limit = input.size + 1,
            )
        val messages = candidates.take(input.size)
        return ConversationMessageSyncOutput(
            messages = messages,
            nextMessageId = messages.lastOrNull()?.messageId ?: input.afterMessageId,
            hasMore = candidates.size > input.size,
        )
    }

    /** 获取会话中的单条消息，供排队状态轮询使用。 */
    @GetMapping("/conversations/{conversationId}/messages/{messageId}")
    fun getConversationMessage(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable messageId: String,
    ): ConversationMessageOutput = agentsConversationService.getMessage(
        parseAgentsIdentity(pathVariables),
        conversationId,
        messageId,
    )

    /** 获取当前会话的异步任务列表。 */
    @GetMapping("/conversations/{conversationId}/async-tasks")
    fun getConversationAsyncTasks(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid input: AgentAsyncTaskListInput,
    ): Page<AgentAsyncTaskOutput> = agentAsyncTaskService.list(
        parseAgentsIdentity(pathVariables),
        conversationId,
        input,
    )

    /** 增量同步当前会话的活动异步任务和通知消息。 */
    @GetMapping("/conversations/{conversationId}/async-tasks/sync")
    fun syncConversationAsyncTasks(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid input: AgentAsyncTaskSyncInput,
    ): AgentAsyncTaskSyncOutput = agentAsyncTaskService.sync(
        parseAgentsIdentity(pathVariables),
        conversationId,
        input,
    )

    /** 获取当前会话的一条异步任务。 */
    @GetMapping("/conversations/{conversationId}/async-tasks/{asyncTaskId}")
    fun getConversationAsyncTask(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable("asyncTaskId") asyncTaskId: String,
    ): AgentAsyncTaskOutput = agentAsyncTaskService.get(
        parseAgentsIdentity(pathVariables),
        conversationId,
        asyncTaskId,
    )

    /** 获取当前 master 会话创建的 Subagent 任务列表。 */
    @GetMapping("/conversations/{conversationId}/subagents")
    fun getConversationSubagents(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid input: AgentAsyncTaskListInput,
    ): Page<SubagentTaskOutput> = subagentTaskQueryService.list(
        parseAgentsIdentity(pathVariables),
        conversationId,
        input,
    )

    /** 增量同步当前 master 会话的 Subagent 状态。 */
    @GetMapping("/conversations/{conversationId}/subagents/sync")
    fun syncConversationSubagents(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid input: SubagentTaskSyncInput,
    ): SubagentTaskSyncOutput = subagentTaskQueryService.sync(
        parseAgentsIdentity(pathVariables),
        conversationId,
        input,
    )

    /** 获取当前 master 会话下的单个 Subagent 状态。 */
    @GetMapping("/conversations/{conversationId}/subagents/{subagentTaskId}")
    fun getConversationSubagent(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable subagentTaskId: String,
    ): SubagentTaskOutput = subagentTaskQueryService.get(
        parseAgentsIdentity(pathVariables),
        conversationId,
        subagentTaskId,
    )

    /** 获取当前 master 会话下的 Subagent 执行结果。 */
    @GetMapping("/conversations/{conversationId}/subagents/{subagentTaskId}/result")
    fun getConversationSubagentResult(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable subagentTaskId: String,
    ): SubagentTaskResultOutput = subagentTaskQueryService.result(
        parseAgentsIdentity(pathVariables),
        conversationId,
        subagentTaskId,
    )

    /** 取消当前 master 会话下尚未完成的 Subagent。 */
    @DeleteMapping("/conversations/{conversationId}/subagents/{subagentTaskId}")
    fun cancelConversationSubagent(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable subagentTaskId: String,
    ): SubagentTaskOutput = subagentTaskQueryService.cancel(
        parseAgentsIdentity(pathVariables),
        conversationId,
        subagentTaskId,
    )

    /** 取消尚未开始执行的排队消息。 */
    @DeleteMapping("/conversations/{conversationId}/messages/{messageId}/queue")
    fun cancelQueuedMessage(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable messageId: String,
    ): ConversationMessageOutput = agentMessageQueueService.cancelQueuedMessage(
        parseAgentsIdentity(pathVariables),
        conversationId,
        messageId,
    )

    /** 获取已完结对话消息的事件列表。 */
    @GetMapping("/events", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun getChatEvents(
        @PathVariable pathVariables: Map<String, String>,
        @RequestParam conversationId: String,
        @RequestParam messageId: String,
    ): List<AiChatBriefEvent> = readChatEvents(
        parseAgentsIdentity(pathVariables),
        conversationId,
        messageId,
    )

    /** 批量获取同一对话下多条消息的事件列表。 */
    @PostMapping("/events/batch", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun getChatEventsBatch(
        @PathVariable pathVariables: Map<String, String>,
        @Valid @RequestBody input: AiChatEventsBatchInput,
    ): AiChatEventsBatchOutput = readChatEventsBatch(
        parseAgentsIdentity(pathVariables),
        input.conversationId,
        input.messageIds,
    )

    /**
     * 提交计划审批结果
     *
     * 通过 [PlanApprovalStoreService] 提交审批结果，存储服务负责唤醒阻塞的工具线程。
     */
    @PostMapping("/plan/approve")
    fun approvePlan(@Valid @RequestBody input: PlanApprovalInput,): PlanApprovalOutput {
        assertInteractionAccess(input.conversationId, input.messageId)
        val result =
            if (input.approved) {
                PlanApprovalResult.Approved()
            } else {
                PlanApprovalResult.Rejected(input.feedback)
            }

        val success =
            planApprovalStoreService.submitApproval(
                conversationId = input.conversationId,
                messageId = input.messageId,
                result = result,
            )
        return PlanApprovalOutput(success = success)
    }

    /**
     * 查询计划审批状态
     */
    @GetMapping("/plan/{planId}/status")
    fun getPlanStatus(@PathVariable planId: String,): PlanStatusOutput {
        val meta = planApprovalStoreService.getPendingById(planId)
        if (meta != null) assertInteractionAccess(meta.conversationId, meta.messageId)
        return if (meta != null) {
            PlanStatusOutput(
                pending = true,
                status = "AWAITING_APPROVAL",
            )
        } else {
            PlanStatusOutput(
                pending = false,
                status = "EXPIRED_OR_NOT_FOUND",
            )
        }
    }

    /** 按公开的会话消息标识确认审批等待，供输入框和重连回放复核。 */
    @GetMapping("/conversations/{conversationId}/messages/{messageId}/plan/status")
    fun getMessagePlanStatus(@PathVariable conversationId: String, @PathVariable messageId: String,): PlanStatusOutput {
        assertInteractionAccess(conversationId, messageId)
        val pending = planApprovalStoreService.getPending(conversationId, messageId) != null
        return PlanStatusOutput(
            pending = pending,
            status = if (pending) "AWAITING_APPROVAL" else "EXPIRED_OR_NOT_FOUND",
        )
    }

    /**
     * 查询用户输入提问是否仍在等待
     *
     * 前端重连 SSE 后回放历史事件时，调用此接口确认提问是否仍在等待中。
     */
    @GetMapping("/user-input/{questionId}/status")
    fun getUserInputStatus(
        @PathVariable questionId: String,
        @RequestParam conversationId: String,
        @RequestParam messageId: String,
    ): UserInputStatusOutput {
        assertInteractionAccess(conversationId, messageId)
        val pendingInput = askUserQuestionStoreService.getPending(questionId, conversationId, messageId)
        return if (pendingInput != null) {
            UserInputStatusOutput(
                pending = true,
                question = pendingInput.question,
                questionDetails = pendingInput.questionDetails,
                options = pendingInput.options,
                multiple = pendingInput.multiple,
            )
        } else {
            UserInputStatusOutput(pending = false)
        }
    }

    /**
     * 提交用户对智能体提问的回答
     *
     * 通过 [AskUserQuestionStoreService] 提交回答，存储服务负责唤醒阻塞的工具线程。
     */
    @PostMapping("/user-input/answer")
    fun submitUserInputAnswer(@Valid @RequestBody input: UserInputAnswerInput,): UserInputAnswerOutput {
        assertInteractionAccess(input.conversationId, input.messageId)
        val pendingInput =
            askUserQuestionStoreService.getPending(
                input.questionId,
                input.conversationId,
                input.messageId,
            ) ?: return UserInputAnswerOutput(success = false, message = "提问不存在或已超时")
        val answer = validateUserInputAnswer(pendingInput, input.selectedOptions, input.customInput)
        val success =
            askUserQuestionStoreService.submitAnswer(
                questionId = input.questionId,
                conversationId = input.conversationId,
                messageId = input.messageId,
                answer = answer,
            )
        return if (success) {
            UserInputAnswerOutput(success = true)
        } else {
            UserInputAnswerOutput(success = false, message = "提问不存在或已超时")
        }
    }

    private fun validateUserInputAnswer(
        meta: AskUserMeta,
        selectedOptions: List<String>,
        customInput: String?,
    ): AskUserAnswer {
        val normalizedOptions = selectedOptions.map(String::trim)
        val normalizedCustomInput = customInput?.trim()
        if (customInput != null && normalizedCustomInput.isNullOrEmpty()) {
            throw BadRequestException("ai.ask_user.answer_invalid", "自定义输入不能为空")
        }
        if (normalizedOptions.any(String::isEmpty)) {
            throw BadRequestException("ai.ask_user.answer_invalid", "至少需要选择一个非空选项")
        }
        if (normalizedOptions.distinct().size != normalizedOptions.size) {
            throw BadRequestException("ai.ask_user.answer_invalid", "选择的选项不能重复")
        }
        if (normalizedOptions.isEmpty() && normalizedCustomInput == null) {
            throw BadRequestException("ai.ask_user.answer_invalid", "至少需要选择一个选项或填写自定义输入")
        }
        if (normalizedOptions.isNotEmpty() && normalizedCustomInput != null) {
            throw BadRequestException("ai.ask_user.answer_invalid", "预设选项与自定义输入不能同时提交")
        }
        val availableOptions = meta.options.map { it.text }.toSet()
        if (normalizedOptions.any { it !in availableOptions }) {
            throw BadRequestException("ai.ask_user.answer_invalid", "选择中包含当前问题未提供的选项")
        }
        if (!meta.multiple && normalizedOptions.size > 1) {
            throw BadRequestException("ai.ask_user.answer_invalid", "单选问题只能选择一个选项")
        }
        return AskUserAnswer(
            selectedOptions = normalizedOptions,
            customInput = normalizedCustomInput,
        )
    }

    /**
     * 生成预签名写入地址
     *
     * 用于客户端直传文件到对象存储
     *
     * @param input 生成预签名 URL 参数
     * @return 预签名 URL 信息
     */
    @PostMapping("/files/pre-signed-url/write")
    fun generatePreSignedWriteUrl(
        @Valid @RequestBody input: GeneratePreSignedUrlInput,
    ): GeneratePreSignedUrlWriteOutput {
        beforeUploadUrl(input)
        // 使用默认选项生成预签名 URL（1小时有效期，PUT 方法）
        return fileService
            .generatePreSignedWriteUrl(
                input = input,
                options =
                GeneratePreSignedUrlOptions(
                    timeout = Duration.ofHours(1),
                    method = HttpMethod.PUT,
                ),
            ).also(::afterUploadUrl)
    }

    /**
     * 预签名文件上传结果确认
     *
     * 客户端使用预签名 URL 完成上传后，调用此接口确认并创建文件记录
     *
     * @param input 上传结果确认参数
     * @return 文件信息
     */
    @PostMapping("/files/pre-signed-url/confirm")
    fun confirmPreSignedUrlUpload(@Valid @RequestBody input: PreSignedUrlFileUploadResultInput,): FileOutput {
        beforeUploadConfirmation(input)
        return fileService.preSignedUrlFileUploadResult(input).also(::afterFileCreated).toFileOutput()
    }

    /**
     * 手动创建文件记录
     *
     * 用于已存在的文件创建记录
     *
     * @param input 创建文件参数
     * @return 文件信息
     */
    @PostMapping("/files/contentMd5")
    fun createFile(@Valid @RequestBody input: CreateFileInput,): FileOutput {
        if (!canReuseFile(
                input.contentMd5,
            )
        ) {
            throw ForbiddenException(code = "openapi.file.forbidden", message = "当前用户无权复用该文件")
        }
        return fileService.createFile(input).also(::afterFileCreated).toFileOutput()
    }

    /**
     * 根据文件唯一值查询文件元数据是否存在
     */
    @GetMapping("/files/meta/contentMd5")
    fun existsMetaByContentMd5(@RequestParam contentMd5: String,): FileExistsOutput =
        if (canReuseFile(contentMd5)) fileService.existsMetaByContentMd5(contentMd5) else FileExistsOutput(false)

    /**
     * 校验文件与会话制品或会话根工作区关系后生成预签名读取地址。
     *
     * @param conversationId 请求会话 ID，可为根会话或 subagent 会话
     * @param fileId 文件 ID
     * @return 预签名读取 URL
     */
    @GetMapping("/conversations/{conversationId}/files/{fileId}/preview")
    fun generatePreSignedReadUrlSimple(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable fileId: Long,
    ): PreSignedUrlReadOutput = readConversationFilePreviewUrl(
        parseAgentsIdentity(pathVariables),
        conversationId,
        fileId,
    )

    /** 生成计划审批中间态快照文件的预签名读取 URL。 */
    @GetMapping("/conversations/{conversationId}/messages/{messageId}/plan-intermediate-files/{fileId}/preview")
    fun generatePlanIntermediateFilePreviewUrl(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @PathVariable messageId: String,
        @PathVariable fileId: Long,
    ): PreSignedUrlReadOutput = readPlanIntermediateFilePreviewUrl(
        identity = parseAgentsIdentity(pathVariables),
        conversationId = conversationId,
        messageId = messageId,
        fileId = fileId,
    )

    /**
     * 批量获取引用元数据
     *
     * 接收一组 [ReturnedReference]，按引用类型分组查询后返回对应的 [CitationMetadataOutput] 列表。
     */
    @PostMapping("/knowledge-bases/citations/metadata")
    fun batchGetCitationMetadata(@RequestBody references: List<ReturnedReference>,): List<CitationMetadataOutput> {
        assertCitationAccess(references)
        return readCitationMetadata(references)
    }

    /**
     * 获取单条引用元数据
     *
     * 根据引用类型和 ID 查询对应的元数据。
     */
    @GetMapping("/knowledge-bases/citations/{citationType}/{referenceId}/metadata")
    fun getCitationMetadata(
        @PathVariable citationType: KnowledgeCitationType,
        @PathVariable referenceId: Long,
    ): CitationMetadataOutput {
        assertCitationAccess(listOf(ReturnedReference(citationType, referenceId)))
        return readCitationMetadata(citationType, referenceId)
    }

    /** 获取会话工作区文件及非文件制品。 */
    @GetMapping("/conversations/{conversationId}/workspace/files")
    fun listWorkspaceFiles(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @Valid input: WorkspaceFileListInput,
    ): WorkspaceArtifactListOutput = readWorkspaceArtifacts(
        parseAgentsIdentity(pathVariables),
        conversationId,
        input,
    )

    /** 生成会话工作区文件的预签名读取 URL。 */
    @GetMapping("/conversations/{conversationId}/workspace/files/preview")
    fun generateWorkspaceFilePreviewUrl(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable conversationId: String,
        @RequestParam path: String,
    ): PreSignedUrlReadOutput = readWorkspaceFilePreviewUrl(
        parseAgentsIdentity(pathVariables),
        conversationId,
        path,
    )

    private fun resolveHistoryAgents(pathVariables: Map<String, String>, conversationId: String,): AgentHandle {
        val identity = parseAgentsIdentity(pathVariables)
        return resolveAgents(
            identity = identity,
            pathVariables = pathVariables,
            conversationId = conversationId,
            conversationIdSource = ConversationIdSource.HISTORY,
            chatModelSpec = null,
        )
    }

    private fun resolveAgents(
        identity: AgentsConversationIdentity,
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        chatModelSpec: ChatModelSpec?,
    ): AgentHandle {
        if (conversationIdSource == ConversationIdSource.HISTORY) {
            agentsConversationService.assertConversationBelongsToIdentity(identity, conversationId)
        }
        return getAgents(
            pathVariables = pathVariables,
            conversationId = conversationId,
            conversationIdSource = conversationIdSource,
            chatModelSpec = chatModelSpec,
        )
    }

    private fun resolveChatAgents(
        identity: AgentsConversationIdentity,
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        chatModelSpec: ChatModelSpec?,
    ): ResolvedChatAgents {
        if (conversationIdSource == ConversationIdSource.HISTORY) {
            agentsConversationService.assertConversationBelongsToIdentity(identity, conversationId)
        }
        return getAgentsForChat(
            pathVariables = pathVariables,
            conversationId = conversationId,
            conversationIdSource = conversationIdSource,
            chatModelSpec = chatModelSpec,
        )
    }

    /**
     * 解析支持的附件拓展名列表
     *
     * 合并 context 自带的内置工具/内部工具与 skills 中绑定的工具，
     * 内置工具中的 [BuiltInToolOptions.FILES] 贡献 [TextFileSupport.SUPPORTED_EXTENSIONS]，
     * 内部工具通过 [InternalToolFactory.supportAttachmentsExt] 声明各自支持的拓展名。
     * 最终按 MIME 类型匹配过滤，转为 [AttachmentExtOutput] 列表供前端展示。
     */
    private fun resolveAttachmentExt(context: AgentsConfigContext): List<AttachmentExtOutput> {
        // 考虑到实际场景的复杂性，这里支持所有文件类型处理
        return listOf(
            AttachmentExtOutput(
                ext = "*",
                media = "*/*",
            ),
        )
    }

    /**
     * 构造用户消息，含文件上下文提示
     *
     * 用户上传的附件会被预生成工作区相对路径（`attachments/<uniqueName>`），并以 [MediaAttachment]
     * 形式注入 [UserMessage]，让模型用 path 引用而非 fileId。
     *
     * 实际的附件下载与工作区登记（`AgentWorkspaceCache.createFile`）由 [DelegatingAgent] 在
     * `messageId` 生成后执行，避免此处还没拿到真实 `messageId` 时只能用临时序号兜底写入映射表。
     */
    private fun buildUserMessage(conversationId: String, input: AiChatInput,): UserMessage {
        val files = input.files
        if (files.isNullOrEmpty()) {
            return UserMessage(input.query)
        }

        val fileIds = files.map { it.id }
        val fileInfos = fileService.findMetasByIds(fileIds)

        if (fileInfos.size != fileIds.size) {
            val foundIds = fileInfos.map { it.id!! }.toSet()
            val missingIds = fileIds.filterNot { it in foundIds }
            throw NotFoundException("以下文件不存在：$missingIds")
        }

        val usedNames = mutableSetOf<String>()
        val attachments =
            fileInfos.map { filePo ->
                val mimeType =
                    MediaTypeFactory.getMediaType(filePo.fileName)
                        ?: throw NotSupportedException("不支持文件类型：${filePo.fileName}")

                // 同时检查本次请求和持久工作区，避免重启或并发消息后复用已有附件路径。
                val uniqueName = uniqueAttachmentName(conversationId, filePo.fileName, usedNames)
                usedNames.add(uniqueName)
                val relativePath = "attachments/$uniqueName"

                MediaAttachment(
                    path = relativePath,
                    fileId = filePo.id!!,
                    fileSize = filePo.size,
                    fileName = filePo.fileName,
                    mimeType = mimeType,
                )
            }

        return UserMessage(
            text = input.query,
            attachments = attachments,
        )
    }

    /** 重新确认排队期间附件没有被删除，且仍属于当前租户可见范围。 */
    private fun validateQueuedAttachments(userMessage: UserMessage) {
        val attachmentIds = userMessage.attachments.orEmpty().map(MediaAttachment::fileId)
        attachmentIds.forEach(::assertAttachmentAccess)
        if (attachmentIds.isEmpty()) return
        val availableIds = fileService.findMetasByIds(attachmentIds).mapNotNull { it.id }.toSet()
        val missingIds = attachmentIds.filterNot(availableIds::contains)
        if (missingIds.isNotEmpty()) {
            throw NotFoundException("以下排队消息附件不存在或已不可访问：$missingIds")
        }
    }

    /**
     * 附件名唯一化：本次请求或持久工作区已占用时，从原始文件名生成有界重试候选名。
     */
    private fun uniqueAttachmentName(workspaceId: String, fileName: String, usedNames: Set<String>,): String {
        val dot = fileName.lastIndexOf('.')
        val (base, extension) =
            if (dot > 0) {
                fileName.substring(0, dot) to fileName.substring(dot)
            } else {
                fileName to ""
            }

        val originalCandidate = attachmentFileName(base, extension, suffix = "")
        if (originalCandidate !in usedNames && !isAttachmentPathOccupied(workspaceId, originalCandidate)) {
            return originalCandidate
        }

        repeat(MAX_ATTACHMENT_NAME_ATTEMPTS) {
            val candidate =
                attachmentFileName(
                    base = base,
                    extension = extension,
                    suffix = randomString(ATTACHMENT_NAME_SUFFIX_LENGTH),
                )
            if (candidate !in usedNames && !isAttachmentPathOccupied(workspaceId, candidate)) {
                return candidate
            }
        }

        throw ConflictException()
    }

    private fun isAttachmentPathOccupied(workspaceId: String, fileName: String,): Boolean =
        workspaceInputFileService.isPathOccupied(workspaceId, "attachments/$fileName")

    private fun attachmentFileName(base: String, extension: String, suffix: String,): String {
        val suffixPart = if (suffix.isEmpty()) "" else "_$suffix"
        val extensionBytes = extension.toByteArray(StandardCharsets.UTF_8).size
        val suffixBytes = suffixPart.toByteArray(StandardCharsets.UTF_8).size
        val availableBaseBytes = MAX_SEGMENT_BYTES - extensionBytes - suffixBytes
        if (availableBaseBytes < 0) {
            throw BadRequestException("ai.chat.attachment_name_too_long", "附件扩展名超过工作区文件名长度限制")
        }

        val truncatedBase = truncateUtf8(base, availableBaseBytes)
        return "$truncatedBase$suffixPart$extension"
    }

    private fun truncateUtf8(value: String, maxBytes: Int,): String {
        if (value.toByteArray(StandardCharsets.UTF_8).size <= maxBytes) return value

        val result = StringBuilder()
        var offset = 0
        var byteCount = 0
        while (offset < value.length) {
            val codePoint = value.codePointAt(offset)
            val codePointString = String(Character.toChars(codePoint))
            val codePointBytes = codePointString.toByteArray(StandardCharsets.UTF_8).size
            if (byteCount + codePointBytes > maxBytes) break
            result.appendCodePoint(codePoint)
            byteCount += codePointBytes
            offset += Character.charCount(codePoint)
        }
        return result.toString()
    }
}
