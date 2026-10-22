package cc.lingya.xiaolingtong.agents.server.controller

import cc.lingya.xiaolingtong.agentruntime.AbstractAgentsController
import cc.lingya.xiaolingtong.agentruntime.AgentHandle
import cc.lingya.xiaolingtong.agentruntime.ConversationIdSource
import cc.lingya.xiaolingtong.agentruntime.ResolvedChatAgents
import cc.lingya.xiaolingtong.agentruntime.model.po.OpenApiCredentialPo
import cc.lingya.xiaolingtong.agentruntime.provider.openapi.OpenApiChannelRegistry
import cc.lingya.xiaolingtong.agents.server.auth.OpenApiAuthenticationFilter
import cc.lingya.xiaolingtong.agents.server.model.mo.OpenApiChannelIdentity
import cc.lingya.xiaolingtong.agents.server.service.OpenApiChannelAuthorization
import cc.lingya.xiaolingtong.agents.server.service.OpenApiPreSignedTokenService
import cc.lingya.xiaolingtong.agents.server.service.OpenApiResourceAccess
import cc.lingya.xiaolingtong.ai.AgentsFactory
import cc.lingya.xiaolingtong.ai.ModelProviderKeyService
import cc.lingya.xiaolingtong.ai.agents.context.BuiltInToolOptions
import cc.lingya.xiaolingtong.ai.model.AgentsConfigContext
import cc.lingya.xiaolingtong.ai.model.AgentsConversationIdentity
import cc.lingya.xiaolingtong.ai.model.ChatModelSpec
import cc.lingya.xiaolingtong.ai.model.DefaultAiChatModelConfig.Companion.toConfig
import cc.lingya.xiaolingtong.ai.model.dto.output.ModelKeyGroupOutput
import cc.lingya.xiaolingtong.ai.model.queue.QueuedAgentMessageExecution
import cc.lingya.xiaolingtong.auth.controller.interceptor.openapi.OpenApiAuth
import cc.lingya.xiaolingtong.common_util.context.tenant.TenantContext
import cc.lingya.xiaolingtong.common_util.context.user.OpenApiUserInfo
import cc.lingya.xiaolingtong.common_util.context.user.UserContext
import cc.lingya.xiaolingtong.common_util.exception.ForbiddenException
import cc.lingya.xiaolingtong.common_util.exception.NotFoundException
import cc.lingya.xiaolingtong.discovery.loadbalance.agents_server.AgentsServerRoutingStorage
import cc.lingya.xiaolingtong.discovery.model.ServiceInstance
import cc.lingya.xiaolingtong.files.model.dto.input.GeneratePreSignedUrlInput
import cc.lingya.xiaolingtong.files.model.dto.input.PreSignedUrlFileUploadResultInput
import cc.lingya.xiaolingtong.files.model.dto.output.GeneratePreSignedUrlWriteOutput
import cc.lingya.xiaolingtong.files.model.po.FilePo
import cc.lingya.xiaolingtong.knowledge.model.ReturnedReference
import io.micrometer.core.instrument.MeterRegistry
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * OpenAPI 原生渠道，继承完整对话能力并限定外部用户资源范围。
 *
 * @author 思追(shaco)
 */
@RestController
@OpenApiAuth
@RequestMapping("/api/agents/channel/openapi/v1/{channelId}/chat")
class OpenApiChannelChatController(
    private val metrics: MeterRegistry,
    private val registry: OpenApiChannelRegistry,
    private val authorization: OpenApiChannelAuthorization,
    private val tokens: OpenApiPreSignedTokenService,
    private val resources: OpenApiResourceAccess,
    private val agentsServerRoutingStorage: AgentsServerRoutingStorage,
    private val serviceInstance: ServiceInstance,
    private val modelProviderKeyService: ModelProviderKeyService,
    agentsFactory: AgentsFactory,
) : AbstractAgentsController(agentsFactory.chatEventHandler) {

    /** 配额身份来自渠道所属部署，认证和资源归属继续由渠道校验。 */
    override fun externalRequestAgentId(pathVariables: Map<String, String>): Long =
        resolveBinding(resolveChannelId(pathVariables)).agentId

    /** 使用已验签的 AK/SK 签发十分钟内有效的一次性令牌，新请求及重连需分别签发。 */
    @OpenApiAuth(signatureRequired = true)
    @PostMapping("/presign")
    fun presign(@PathVariable channelId: String, request: HttpServletRequest, response: HttpServletResponse,) = run {
        val user = user()
        authorization.assertUser(user, channelId)
        val credential =
            request.getAttribute(OpenApiAuthenticationFilter.VERIFIED_CREDENTIAL_ATTRIBUTE)
                as? OpenApiCredentialPo
                ?: throw ForbiddenException(code = "openapi.forbidden", message = "需要 AK/SK 签名身份")
        response.setHeader("Cache-Control", "no-store")
        tokens.issue(credential, user)
    }

    /** 排队消息恢复失败时记录渠道指标，保留原异常供队列框架处理。 */
    override fun executeQueuedMessage(execution: QueuedAgentMessageExecution) {
        try {
            super.executeQueuedMessage(execution)
        } catch (error: Exception) {
            metrics.counter("openapi.queue.failed").increment()
            throw error
        }
    }

    /** 按已发布渠道运行配置生成安全的模型能力展示。 */
    override fun getModelKeyGroupOutputs(
        pathVariables: Map<String, String>,
        context: AgentsConfigContext,
    ): List<ModelKeyGroupOutput> = context.availableModels
        .filterIsInstance<ChatModelSpec>()
        .groupBy { it.keyGroupId }
        .mapNotNull { (keyGroupId, models) ->
            if (keyGroupId == -1L) return@mapNotNull null
            val modelNames = models.map { it.model }.toSet()
            ModelKeyGroupOutput(
                keyGroupId = keyGroupId,
                keyGroupName = "已发布模型",
                models =
                modelProviderKeyService
                    .findAllChatModelConfigByKeyGroupId(keyGroupId)
                    .filter { it.modelName in modelNames }
                    .map { it.toConfig() },
            )
        }

    /** 获取本次操作的 Agent 使用权，由调用方释放。 */
    override fun getAgents(
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        chatModelSpec: ChatModelSpec?,
    ): AgentHandle = getAgentsForChat(
        pathVariables = pathVariables,
        conversationId = conversationId,
        conversationIdSource = conversationIdSource,
        chatModelSpec = chatModelSpec,
    ).handle

    /** 获取 Agent 使用权以及本轮有效模型配置。 */
    override fun getAgentsForChat(
        pathVariables: Map<String, String>,
        conversationId: String,
        conversationIdSource: ConversationIdSource,
        chatModelSpec: ChatModelSpec?,
    ): ResolvedChatAgents {
        val channelId = resolveChannelId(pathVariables)
        val binding = resolveBinding(channelId)
        return ResolvedChatAgents(
            handle = binding.runtimeInstance.getAgents(conversationId),
            chatModelSpec = binding.runtimeInstance.getRuntimeConf().chatModelSpec,
        )
    }

    /** 从已认证用户解析会话身份。 */
    override fun parseAgentsIdentity(pathVariables: Map<String, String>): AgentsConversationIdentity =
        identity(resolveChannelId(pathVariables))

    /** 中断前确认 OpenAPI 用户身份与渠道绑定仍有效。 */
    override fun assertConversationInterruptAccess(
        pathVariables: Map<String, String>,
        identity: AgentsConversationIdentity,
        conversationId: String,
    ) {
        resolveBinding(resolveChannelId(pathVariables))
    }

    /** 读取已发布运行时的能力配置。 */
    override fun getAgentsConfigContext(pathVariables: Map<String, String>): AgentsConfigContext {
        val channelId = resolveChannelId(pathVariables)
        val binding = resolveBinding(channelId)
        val conf = binding.runtimeInstance.getRuntimeConf()
        val chatModelSpec = conf.chatModelSpec
        return AgentsConfigContext(
            defaultModel = chatModelSpec,
            availableModels = listOf(chatModelSpec),
            builtInToolOptions = BuiltInToolOptions.DEFAULT_OPTIONS,
            internalTools = conf.internalTools,
            skills = conf.skills,
        )
    }

    /** 将会话路由更新到实际执行节点。 */
    override fun beforeChatExecution(pathVariables: Map<String, String>, conversationId: String,) {
        // 排队消息可能由其他实例认领，必须在实际执行实例覆盖 SSE 路由。
        val channelId = resolveChannelId(pathVariables)
        agentsServerRoutingStorage.upsertConversationRouting(
            tenantId = TenantContext.getTenantId(),
            channelId = channelId,
            conversationId = conversationId,
            instanceId = serviceInstance.id,
        )
    }

    /** 恢复当前 HTTP 或排队消息的用户身份。 */
    override fun currentRequestIdentity(): AgentsConversationIdentity = identity(user().channelId)

    /** 检查当前外部用户的附件授权。 */
    override fun assertAttachmentAccess(fileId: Long) = resources.assertFile(fileId)

    /** 检查覆盖上传文件的归属。 */
    override fun beforeUploadUrl(input: GeneratePreSignedUrlInput) {
        resources.assertUploadInput(input)
    }

    /** 绑定上传凭据与当前用户。 */
    override fun afterUploadUrl(output: GeneratePreSignedUrlWriteOutput) {
        output.fileUk?.let(resources::issued)
    }

    /** 检查上传凭据归属。 */
    override fun beforeUploadConfirmation(input: PreSignedUrlFileUploadResultInput) =
        resources.assertUpload(input.fileUk)

    /** 记录当前用户的文件访问授权。 */
    override fun afterFileCreated(file: FilePo) = resources.grant(file)

    /** 仅允许复用当前用户已授权的内容。 */
    override fun canReuseFile(contentMd5: String): Boolean = resources.canReuse(contentMd5)

    /** 检查引用属于当前发布知识范围。 */
    override fun assertCitationAccess(references: List<ReturnedReference>) = resources.assertReferences(
        references,
        resolveBinding(user().channelId).runtimeInstance.getRuntimeConf().knowledgeVersionIds,
    )

    private fun identity(channelId: String): OpenApiChannelIdentity {
        val user = user()
        authorization.assertUser(user, channelId)
        return OpenApiChannelIdentity(channelId, user.userId)
    }

    private fun user(): OpenApiUserInfo = UserContext.getAuthenticatedUser() as? OpenApiUserInfo
        ?: throw ForbiddenException(code = "openapi.forbidden", message = "需要 OpenAPI 身份")

    private fun resolveChannelId(pathVariables: Map<String, String>): String =
        pathVariables["channelId"] ?: throw NotFoundException(code = "openapi.notfound", message = "渠道不存在")

    private fun resolveBinding(channelId: String) = registry.get(channelId)?.also { identity(channelId) }
        ?: throw NotFoundException(code = "openapi.notfound", message = "渠道不存在或已下线")
}
