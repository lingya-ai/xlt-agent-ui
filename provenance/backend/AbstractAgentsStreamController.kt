package cc.lingya.xiaolingtong.agentruntime

import cc.lingya.xiaolingtong.agentruntime.api.AgentMessageStreamProvider
import cc.lingya.xiaolingtong.agentruntime.api.AgentStreamApi
import cc.lingya.xiaolingtong.agentruntime.config.AgentRuntimeWebSocketProperties
import cc.lingya.xiaolingtong.agentruntime.model.dto.input.ChatStreamProbeInput
import cc.lingya.xiaolingtong.agentruntime.model.dto.output.ChatStreamProbeEventOutput
import cc.lingya.xiaolingtong.agentruntime.stream.ChatSseHeartbeat
import cc.lingya.xiaolingtong.agentruntime.stream.agentChatDeliveryGuard
import cc.lingya.xiaolingtong.agentruntime.stream.websocket.AgentChatDeliveryAccess
import cc.lingya.xiaolingtong.agentruntime.stream.websocket.AgentChatWebSocketConnectionContext
import cc.lingya.xiaolingtong.agentruntime.stream.websocket.AgentChatWebSocketHandler
import cc.lingya.xiaolingtong.ai.AgentsConversationService
import cc.lingya.xiaolingtong.ai.agents.ChatUIEventStream
import cc.lingya.xiaolingtong.ai.model.AgentsConversationIdentity
import cc.lingya.xiaolingtong.ai.model.ConversationMessageStatus
import cc.lingya.xiaolingtong.ai.model.chat.brief.AiChatBriefEvent
import cc.lingya.xiaolingtong.ai.model.input.AiChatStreamInput
import cc.lingya.xiaolingtong.ai.model.input.ChatStreamSubscriptionInput
import cc.lingya.xiaolingtong.ai.model.output.PreparedChatStream
import cc.lingya.xiaolingtong.common_util.context.ContextSnapshot
import cc.lingya.xiaolingtong.common_util.context.tenant.TenantContext
import cc.lingya.xiaolingtong.common_util.exception.ConflictException
import cc.lingya.xiaolingtong.websocket.WsMapping
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.http.codec.ServerSentEvent
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.socket.WebSocketHandler
import reactor.core.publisher.Flux
import reactor.core.publisher.Mono
import java.time.Duration

/**
 * 统一承载 Agent 聊天的 SSE 与原生 WebSocket 传输入口。
 *
 * 该层负责消息订阅校验、事件来源选择和传输协议适配。[AbstractAgentsConversationReadController]
 * 在此基础上提供其余只读能力，具体 Controller 负责解析入口身份并声明实际 HTTP 或 WebSocket 映射。
 *
 * @author 思追(shaco)
 */
@Transactional(propagation = Propagation.SUPPORTS)
abstract class AbstractAgentsStreamController(
    protected val chatUIEventStream: ChatUIEventStream,
) : AgentStreamApi, AgentMessageStreamProvider {

    private companion object {

        const val STREAM_PROBE_EVENT_COUNT = 4L
        const val STREAM_PROBE_EVENT_NAME = "probe"
        const val NANOS_PER_MILLISECOND = 1_000_000L
        val logger = KotlinLogging.logger {}
    }

    @Autowired
    protected lateinit var agentRuntimeWebSocketProperties: AgentRuntimeWebSocketProperties

    /** 宿主可选提供的长连接投递复核；未提供时不做心跳复核。 */
    @Autowired(required = false)
    protected var agentChatDeliveryAccess: AgentChatDeliveryAccess? = null

    @Autowired
    protected lateinit var agentsConversationService: AgentsConversationService

    /** 按指定身份获取已有会话的 SSE 聊天事件流。 */
    protected fun getChatStreamByConversation(
        identity: AgentsConversationIdentity,
        conversationId: String,
        input: AiChatStreamInput,
    ): Flux<ServerSentEvent<AiChatBriefEvent>> {
        val contextSnapshot = ContextSnapshot.capture()
        return prepareChatStreamByConversation(identity, conversationId, input)
            .flatMapMany { prepared ->
                toSseStream(
                    messageId = input.messageId,
                    prepared = prepared,
                    contextSnapshot = contextSnapshot,
                    baselineRevalidate = { assertMessageStreamable(identity, conversationId, input.messageId) },
                )
            }
    }

    /** 使用已验证的分享身份和租户订阅指定消息的 UI 事件流。 */
    protected fun getChatStreamByAuthorizedConversation(
        identity: AgentsConversationIdentity,
        tenantId: Long,
        conversationId: String,
        input: AiChatStreamInput,
    ): Flux<ServerSentEvent<AiChatBriefEvent>> {
        val contextSnapshot = ContextSnapshot.capture()
        return prepareChatStreamByConversation(
            identity = identity,
            tenantId = tenantId,
            conversationId = conversationId,
            input = input,
        ).flatMapMany { prepared ->
            toSseStream(
                messageId = input.messageId,
                prepared = prepared,
                contextSnapshot = contextSnapshot,
                baselineRevalidate = { assertMessageStreamable(identity, conversationId, input.messageId) },
            )
        }
    }

    /**
     * 获取已有会话的 SSE 聊天事件流。
     *
     * 特殊授权入口可以覆盖此方法，在保持统一路由的同时替换身份与租户解析逻辑。
     */
    @PostMapping("/conversations/{conversationId}/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    override fun getChatStreamBySseConversation(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable @NotBlank @Size(max = 64) conversationId: String,
        @Valid @RequestBody input: AiChatStreamInput,
        @RequestHeader(name = "X-Request-ID", required = false) requestId: String?,
    ): Flux<ServerSentEvent<AiChatBriefEvent>> {
        val stream = getChatStreamByConversation(parseAgentsIdentity(pathVariables), conversationId, input)
        return logSseLifecycle(
            streamType = "chat",
            requestId = requestId,
            identity = "conversationId=$conversationId messageId=${input.messageId}",
            stream = stream,
        )
    }

    /** 解析升级请求，并为当前握手创建独立的 Agent 聊天 WebSocket Handler。*/
    @WsMapping(
        value = ["/conversations/{conversationId}/stream/ws"],
        allowedOriginPatterns = ["*"],
    )
    override fun getChatStreamByWsConversation(
        @PathVariable pathVariables: Map<String, String>,
        @PathVariable @NotBlank @Size(max = 64) conversationId: String,
        @RequestParam(name = "messageId") @NotBlank @Size(max = 64) messageId: String,
        @RequestHeader(name = "X-Request-ID", required = false) @Size(max = 64) requestId: String?,
    ): WebSocketHandler {
        val context = AgentChatWebSocketConnectionContext(
            contextSnapshot = ContextSnapshot.capture(),
            pathVariables = pathVariables,
            conversationId = conversationId.trim(),
            messageId = messageId.trim(),
            requestId = requestId?.trim()?.takeIf(String::isNotEmpty) ?: "missing",
        )
        return AgentChatWebSocketHandler(
            streamProvider = this,
            properties = agentRuntimeWebSocketProperties,
            context = context,
            deliveryAccess = agentChatDeliveryAccess,
        )
    }

    /** 为连接级 WebSocket Handler 准备归属已校验的消息事件流。 */
    override fun prepare(
        pathVariables: Map<String, String>,
        conversationId: String,
        messageId: String,
    ): Mono<PreparedChatStream> = prepareAgentChatWebSocketStream(pathVariables, conversationId, messageId)

    /**
     * 为 WebSocket 传输准备经过身份与消息状态校验的聊天事件流。
     *
     * 资源订阅仍由连接建立回调触发，握手阶段只创建 Handler。
     */
    fun prepareAgentChatWebSocketStream(
        pathVariables: Map<String, String>,
        conversationId: String,
        messageId: String,
    ): Mono<PreparedChatStream> = prepareChatStreamByConversation(
        identity = parseAgentsIdentity(pathVariables),
        conversationId = conversationId,
        input = AiChatStreamInput(messageId = messageId),
    )

    /** 检测当前 Controller 和网关链路能否持续增量传输 SSE。 */
    @PostMapping("/stream-probe", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    override fun streamProbe(
        @Valid @RequestBody input: ChatStreamProbeInput,
        @RequestHeader(name = "X-Request-ID", required = false) requestId: String?,
    ): Flux<ServerSentEvent<ChatStreamProbeEventOutput>> {
        val stream = Flux.defer {
            val startedAt = System.nanoTime()
            Flux.interval(Duration.ZERO, Duration.ofSeconds(1))
                .take(STREAM_PROBE_EVENT_COUNT)
                .map { sequence ->
                    val output = ChatStreamProbeEventOutput(
                        probeId = input.probeId,
                        sequence = sequence.toInt(),
                        serverElapsedMs = (System.nanoTime() - startedAt) / NANOS_PER_MILLISECOND,
                    )
                    ServerSentEvent.builder(output)
                        .id("${input.probeId}:$sequence")
                        .event(STREAM_PROBE_EVENT_NAME)
                        .build()
                }
        }
        return logSseLifecycle(
            streamType = "probe",
            requestId = requestId,
            identity = "probeId=${input.probeId}",
            stream = stream,
        )
    }

    /**
     * 将当前入口路径变量解析为会话身份。
     *
     * 只有实际声明通用聊天流端点的 Controller 才需要覆盖该方法。
     */
    protected open fun parseAgentsIdentity(pathVariables: Map<String, String>): AgentsConversationIdentity {
        throw UnsupportedOperationException("当前只读 Controller 未启用通用聊天流端点")
    }

    /** 校验消息订阅权限并准备与传输协议无关的聊天事件流。 */
    protected fun prepareChatStreamByConversation(
        identity: AgentsConversationIdentity,
        conversationId: String,
        input: AiChatStreamInput,
    ): Mono<PreparedChatStream> {
        assertMessageStreamable(identity, conversationId, input.messageId)
        return prepareChatStream(TenantContext.getTenantId(), conversationId, input)
    }

    private fun prepareChatStreamByConversation(
        identity: AgentsConversationIdentity,
        tenantId: Long,
        conversationId: String,
        input: AiChatStreamInput,
    ): Mono<PreparedChatStream> {
        assertMessageStreamable(identity, conversationId, input.messageId)
        return prepareChatStream(tenantId, conversationId, input)
    }

    private fun assertMessageStreamable(
        identity: AgentsConversationIdentity,
        conversationId: String,
        messageId: String,
    ) {
        val message = agentsConversationService.getMessage(identity, conversationId, messageId)
        when (message.status) {
            ConversationMessageStatus.QUEUED -> throw ConflictException(
                "ai.chat_message_queued",
                "消息仍在排队，开始执行后才能订阅",
            )

            ConversationMessageStatus.CANCELLED -> throw ConflictException(
                "ai.chat_message_cancelled",
                "消息已在执行前取消，不能订阅",
            )

            else -> Unit
        }
    }

    private fun prepareChatStream(
        tenantId: Long,
        conversationId: String,
        input: AiChatStreamInput,
    ): Mono<PreparedChatStream> {
        val subscription = ChatStreamSubscriptionInput(
            tenantId = tenantId,
            conversationId = conversationId,
            messageId = input.messageId,
            count = ChatUIEventStream.DEFAULT_STREAM_READ_COUNT,
            timeout = Duration.ofSeconds(1),
        )
        return chatUIEventStream.prepareStream(subscription)
    }

    private fun toSseStream(
        messageId: String,
        prepared: PreparedChatStream,
        contextSnapshot: ContextSnapshot,
        baselineRevalidate: () -> Unit,
    ): Flux<ServerSentEvent<AiChatBriefEvent>> {
        val businessEvents = prepared.events.map { event ->
            ServerSentEvent.builder<AiChatBriefEvent>()
                .id(messageId)
                .event(event.type.eventType())
                .data(event)
                .build()
        }
        // 来源判定和 read-repair 完成后才发送 ready 并启动 ping，避免过早提交 HTTP 200。
        // 空闲心跳前按当前事实源复核授权，撤权后不再向该 SSE 订阅投递。
        val idleGuard = agentChatDeliveryGuard(
            snapshot = contextSnapshot,
            deliveryAccess = agentChatDeliveryAccess,
            baselineRevalidate = baselineRevalidate,
        )
        return ChatSseHeartbeat.withIdlePing(businessEvents, deliveryGuard = idleGuard)
    }

    private fun <T : Any> logSseLifecycle(
        streamType: String,
        requestId: String?,
        identity: String,
        stream: Flux<T>,
    ): Flux<T> = Flux.defer {
        val startedAt = System.nanoTime()
        val correlationId = requestId?.takeIf { it.isNotBlank() } ?: "missing"
        logger.info { "[Agent SSE开始] type=$streamType requestId=$correlationId $identity" }
        stream.doFinally { signalType ->
            val durationMs = (System.nanoTime() - startedAt) / NANOS_PER_MILLISECOND
            logger.info {
                "[Agent SSE结束] type=$streamType requestId=$correlationId $identity " +
                    "signal=$signalType durationMs=$durationMs"
            }
        }
    }
}
