package cc.lingya.xiaolingtong.agentruntime

import cc.lingya.xiaolingtong.ai.AgentWorkspaceService
import cc.lingya.xiaolingtong.ai.ConversationCorrelationService
import cc.lingya.xiaolingtong.ai.PlanIntermediateFileService
import cc.lingya.xiaolingtong.ai.SqlQueryResultService
import cc.lingya.xiaolingtong.ai.agents.ChatUIEventStream
import cc.lingya.xiaolingtong.ai.agents.tools.workspace.artifact.WorkspaceNonFileArtifactQueryService
import cc.lingya.xiaolingtong.ai.model.AgentsConversationIdentity
import cc.lingya.xiaolingtong.ai.model.SqlQueryResultExportFormat
import cc.lingya.xiaolingtong.ai.model.chat.brief.AiChatBriefEvent
import cc.lingya.xiaolingtong.ai.model.chat.brief.AiChatEndBriefEvent
import cc.lingya.xiaolingtong.ai.model.input.AgentsMessageListInput
import cc.lingya.xiaolingtong.ai.model.input.ExcelSqlQueryResultPageInput
import cc.lingya.xiaolingtong.ai.model.input.WorkspaceFileListInput
import cc.lingya.xiaolingtong.ai.model.output.AiChatEventsBatchOutput
import cc.lingya.xiaolingtong.ai.model.output.ConversationMessageOutput
import cc.lingya.xiaolingtong.ai.model.output.ExcelSqlChartDatasetOutput
import cc.lingya.xiaolingtong.ai.model.output.ExcelSqlQueryResultPageOutput
import cc.lingya.xiaolingtong.ai.model.output.WorkspaceArtifactListOutput
import cc.lingya.xiaolingtong.ai.model.output.WorkspaceNonFileArtifactOutput.Companion.toWorkspaceNonFileArtifactOutput
import cc.lingya.xiaolingtong.common_util.context.space.CollaborationSpaceContext
import cc.lingya.xiaolingtong.common_util.context.tenant.TenantContext
import cc.lingya.xiaolingtong.common_util.exception.NotAcceptableException
import cc.lingya.xiaolingtong.common_util.restful.specification.PageRespMsg.Companion.specification
import cc.lingya.xiaolingtong.files.FilePreviewService
import cc.lingya.xiaolingtong.files.model.dto.output.PreSignedUrlReadOutput
import cc.lingya.xiaolingtong.knowledge.KnowledgeBaseCitationService
import cc.lingya.xiaolingtong.knowledge.model.KnowledgeCitationType
import cc.lingya.xiaolingtong.knowledge.model.ReturnedReference
import cc.lingya.xiaolingtong.knowledge.model.dto.output.CitationMetadataOutput
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.Page
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.nio.file.Files

/**
 * Agent 会话可回放只读控制器基类。
 *
 * [AbstractAgentsController] 与公开分享控制器共同复用这里的消息、事件、SQL 结果、
 * 文件、引用元数据及工作区读取逻辑。
 * 所有入口先完成登录身份或分享链接访问校验；涉及会话范围的数据还需提供已验证的 identity。
 * 工作区文件统一归一到根会话工作区，消息、事件及非文件制品仍按请求会话读取。
 *
 * @author 思追(shaco)
 */
@Transactional(propagation = Propagation.SUPPORTS)
abstract class AbstractAgentsConversationReadController(
    chatUIEventStream: ChatUIEventStream,
) : AbstractAgentsStreamController(chatUIEventStream) {

    @Autowired
    protected lateinit var conversationCorrelationQueryService: ConversationCorrelationService

    @Autowired
    protected lateinit var agentWorkspaceService: AgentWorkspaceService

    @Autowired
    protected lateinit var workspaceNonFileArtifactQueryService: WorkspaceNonFileArtifactQueryService

    @Autowired
    protected lateinit var filePreviewService: FilePreviewService

    @Autowired
    protected lateinit var planIntermediateFileService: PlanIntermediateFileService

    @Autowired
    protected lateinit var knowledgeBaseCitationService: KnowledgeBaseCitationService

    @Autowired
    protected lateinit var excelSqlQueryResultService: SqlQueryResultService

    /** 按当前登录身份读取会话消息。 */
    protected fun readConversationMessages(
        identity: AgentsConversationIdentity,
        conversationId: String,
        input: AgentsMessageListInput,
    ): Page<ConversationMessageOutput> = readConversationMessages(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        input = input,
    )

    /** 按显式租户范围读取会话消息。 */
    protected fun readConversationMessages(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        input: AgentsMessageListInput,
    ): Page<ConversationMessageOutput> = agentsConversationService.getMessages(
        tenantId = tenantId,
        identity = identity,
        conversationId = conversationId,
        input = input,
    )

    /** 按当前登录身份读取单条已完结消息的 UI 事件。 */
    protected fun readChatEvents(
        identity: AgentsConversationIdentity,
        conversationId: String,
        messageId: String,
    ): List<AiChatBriefEvent> = readChatEvents(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        messageId = messageId,
    )

    /** 按显式租户范围读取单条消息事件。 */
    protected fun readChatEvents(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        messageId: String,
    ): List<AiChatBriefEvent> {
        agentsConversationService.assertMessagesBelongToConversation(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
            messageIds = listOf(messageId),
        )
        val events = chatUIEventStream.getEvents(conversationId, messageId)
        val previewUrls = resolveActiveNonFileArtifactPreviewUrls(tenantId, conversationId, events)
        return refreshNonFileArtifactPreviewUrls(events, previewUrls)
    }

    /** 按当前登录身份批量读取已完结消息的 UI 事件。 */
    protected fun readChatEventsBatch(
        identity: AgentsConversationIdentity,
        conversationId: String,
        messageIds: List<String>,
    ): AiChatEventsBatchOutput = readChatEventsBatch(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        messageIds = messageIds,
    )

    /** 按显式租户范围批量读取消息事件。 */
    protected fun readChatEventsBatch(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        messageIds: List<String>,
    ): AiChatEventsBatchOutput = run {
        val distinctMessageIds = messageIds.distinct()
        agentsConversationService.assertMessagesBelongToConversation(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
            messageIds = distinctMessageIds,
        )
        val output = chatUIEventStream.getEventsBatch(conversationId, distinctMessageIds)
        val previewUrls = resolveActiveNonFileArtifactPreviewUrls(
            tenantId,
            conversationId,
            output.records.flatMap { record -> record.events },
        )
        output.copy(
            records = output.records.map { record ->
                record.copy(events = refreshNonFileArtifactPreviewUrls(record.events, previewUrls))
            },
        )
    }

    /** 按当前登录身份分页读取 SQL 查询结果。 */
    protected fun getSqlQueryResult(
        identity: AgentsConversationIdentity,
        conversationId: String,
        resultId: String,
        input: ExcelSqlQueryResultPageInput,
    ): ExcelSqlQueryResultPageOutput = getSqlQueryResult(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        resultId = resultId,
        input = input,
    )

    /** 按显式租户范围读取 SQL 结果页。 */
    protected fun getSqlQueryResult(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        resultId: String,
        input: ExcelSqlQueryResultPageInput,
    ): ExcelSqlQueryResultPageOutput {
        agentsConversationService.assertConversationBelongsToIdentity(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
        )
        return getSqlQueryResult(
            tenantId = tenantId,
            conversationId = conversationId,
            resultId = resultId,
            input = input,
        )
    }

    /** 按已验证的分享会话分页读取 SQL 查询结果。 */
    protected fun getSqlQueryResult(
        tenantId: Long,
        conversationId: String,
        resultId: String,
        input: ExcelSqlQueryResultPageInput,
    ): ExcelSqlQueryResultPageOutput = excelSqlQueryResultService.page(
        tenantId = tenantId,
        conversationId = conversationId,
        resultId = resultId,
        current = input.current,
        size = input.size,
    )

    /** 按当前应用租户上下文读取 SQL 结果页。 */
    protected fun getSqlQueryResult(
        conversationId: String,
        resultId: String,
        input: ExcelSqlQueryResultPageInput,
    ): ExcelSqlQueryResultPageOutput = getSqlQueryResult(
        tenantId = TenantContext.getTenantId(),
        conversationId = conversationId,
        resultId = resultId,
        input = input,
    )

    /** 按当前登录身份读取 SQL 图表数据。 */
    protected fun getSqlQueryChartData(
        identity: AgentsConversationIdentity,
        conversationId: String,
        resultId: String,
    ): ResponseEntity<ExcelSqlChartDatasetOutput> = getSqlQueryChartData(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        resultId = resultId,
    )

    /** 按显式租户范围读取 SQL 图表数据。 */
    protected fun getSqlQueryChartData(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        resultId: String,
    ): ResponseEntity<ExcelSqlChartDatasetOutput> {
        agentsConversationService.assertConversationBelongsToIdentity(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
        )
        return getSqlQueryChartData(
            tenantId = tenantId,
            conversationId = conversationId,
            resultId = resultId,
        )
    }

    /** 按已验证的分享会话读取 SQL 图表数据。 */
    protected fun getSqlQueryChartData(
        tenantId: Long,
        conversationId: String,
        resultId: String,
    ): ResponseEntity<ExcelSqlChartDatasetOutput> = ResponseEntity.ok()
        .eTag("\"$resultId\"")
        .body(excelSqlQueryResultService.chartData(tenantId, conversationId, resultId))

    /** 按当前应用租户上下文读取 SQL 图表数据。 */
    protected fun getSqlQueryChartData(
        conversationId: String,
        resultId: String,
    ): ResponseEntity<ExcelSqlChartDatasetOutput> = getSqlQueryChartData(
        tenantId = TenantContext.getTenantId(),
        conversationId = conversationId,
        resultId = resultId,
    )

    /** 按当前登录身份导出 SQL 查询结果。 */
    protected fun exportSqlQueryResult(
        identity: AgentsConversationIdentity,
        conversationId: String,
        resultId: String,
        format: SqlQueryResultExportFormat,
        acceptedMediaTypes: List<MediaType>?,
    ): ResponseEntity<StreamingResponseBody> = exportSqlQueryResult(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        resultId = resultId,
        format = format,
        acceptedMediaTypes = acceptedMediaTypes,
    )

    /** 按显式租户范围导出 SQL 结果。 */
    protected fun exportSqlQueryResult(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        resultId: String,
        format: SqlQueryResultExportFormat,
        acceptedMediaTypes: List<MediaType>?,
    ): ResponseEntity<StreamingResponseBody> {
        agentsConversationService.assertConversationBelongsToIdentity(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
        )
        return exportSqlQueryResult(
            tenantId = tenantId,
            conversationId = conversationId,
            resultId = resultId,
            format = format,
            acceptedMediaTypes = acceptedMediaTypes,
        )
    }

    /** 按已验证的分享会话导出 SQL 查询结果。 */
    protected fun exportSqlQueryResult(
        tenantId: Long,
        conversationId: String,
        resultId: String,
        format: SqlQueryResultExportFormat,
        acceptedMediaTypes: List<MediaType>?,
    ): ResponseEntity<StreamingResponseBody> {
        if (!acceptedMediaTypes.isNullOrEmpty() &&
            acceptedMediaTypes.none { acceptedType -> acceptedType.isCompatibleWith(format.mediaType) }
        ) {
            throw NotAcceptableException(
                "excel.sql.export.not-acceptable",
                "客户端不接受 ${format.mediaType} 格式的响应",
            )
        }
        val exportFile = excelSqlQueryResultService.export(
            tenantId = tenantId,
            conversationId = conversationId,
            resultId = resultId,
            format = format,
        )
        try {
            val contentLength = Files.size(exportFile.path)
            val body = StreamingResponseBody { output ->
                try {
                    Files.copy(exportFile.path, output)
                    output.flush()
                } finally {
                    Files.deleteIfExists(exportFile.path)
                }
            }
            return ResponseEntity.ok()
                .contentType(format.mediaType)
                .contentLength(contentLength)
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    contentDisposition(exportFile.fallbackFileName, exportFile.fileName),
                )
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, "Content-Disposition, Content-Type")
                .body(body)
        } catch (e: Exception) {
            Files.deleteIfExists(exportFile.path)
            throw e
        }
    }

    /** 按当前应用租户上下文导出 SQL 结果。 */
    protected fun exportSqlQueryResult(
        conversationId: String,
        resultId: String,
        format: SqlQueryResultExportFormat,
        acceptedMediaTypes: List<MediaType>?,
    ): ResponseEntity<StreamingResponseBody> = exportSqlQueryResult(
        tenantId = TenantContext.getTenantId(),
        conversationId = conversationId,
        resultId = resultId,
        format = format,
        acceptedMediaTypes = acceptedMediaTypes,
    )

    /** 按当前登录身份校验会话文件关系后生成预签名读取 URL。 */
    protected fun readConversationFilePreviewUrl(
        identity: AgentsConversationIdentity,
        conversationId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput = readConversationFilePreviewUrl(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        fileId = fileId,
    )

    /** 按显式租户范围校验会话和文件关系后生成预览地址。 */
    protected fun readConversationFilePreviewUrl(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput {
        agentsConversationService.assertConversationBelongsToIdentity(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
        )
        return readConversationFilePreviewUrl(
            tenantId = tenantId,
            conversationId = conversationId,
            fileId = fileId,
        )
    }

    /**
     * 按已验证的会话访问权限校验会话制品或根工作区文件关系后生成预签名读取 URL。
     *
     * 调用方负责在进入本方法前完成登录身份或分享链接访问校验。
     */
    protected fun readConversationFilePreviewUrl(conversationId: String, fileId: Long): PreSignedUrlReadOutput =
        readConversationFilePreviewUrl(
            tenantId = TenantContext.getTenantId(),
            conversationId = conversationId,
            fileId = fileId,
        )

    /** 按显式租户范围验证文件制品关系并生成预览地址。 */
    protected fun readConversationFilePreviewUrl(
        tenantId: Long,
        conversationId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput {
        if (agentsConversationService.isFileArtifactInConversation(tenantId, conversationId, fileId)) {
            return filePreviewService.generatePreSignedReadUrl(tenantId, fileId)
        }
        // 兼容历史前端通过该接口预览根工作区文件，同时避免放开同租户任意文件的读取权限。
        val workspaceId = conversationCorrelationQueryService.findRootConversationId(tenantId, conversationId)
        return readWorkspaceFileVersionPreviewUrl(tenantId, workspaceId, fileId)
    }

    /** 按当前登录身份校验计划审批快照与消息关系后生成预签名读取 URL。 */
    protected fun readPlanIntermediateFilePreviewUrl(
        identity: AgentsConversationIdentity,
        conversationId: String,
        messageId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput = readPlanIntermediateFilePreviewUrl(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        messageId = messageId,
        fileId = fileId,
    )

    /** 按显式租户范围校验计划快照关系后生成预览地址。 */
    protected fun readPlanIntermediateFilePreviewUrl(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        messageId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput {
        agentsConversationService.assertConversationBelongsToIdentity(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
        )
        return readPlanIntermediateFilePreviewUrl(
            tenantId = tenantId,
            conversationId = conversationId,
            messageId = messageId,
            fileId = fileId,
        )
    }

    /** 按已验证的会话访问权限校验计划审批快照与消息关系后生成预签名读取 URL。 */
    protected fun readPlanIntermediateFilePreviewUrl(
        conversationId: String,
        messageId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput = readPlanIntermediateFilePreviewUrl(
        tenantId = TenantContext.getTenantId(),
        conversationId = conversationId,
        messageId = messageId,
        fileId = fileId,
    )

    /** 按显式租户范围验证计划快照并生成预览地址。 */
    protected fun readPlanIntermediateFilePreviewUrl(
        tenantId: Long,
        conversationId: String,
        messageId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput {
        planIntermediateFileService.assertPreviewFileBelongsToMessage(
            tenantId = tenantId,
            conversationId = conversationId,
            messageId = messageId,
            previewFileId = fileId,
        )
        return filePreviewService.generatePreSignedReadUrl(tenantId, fileId)
    }

    /** 按已验证的根工作区校验文件关系后生成预签名读取 URL。 */
    protected fun readWorkspaceFileVersionPreviewUrl(workspaceId: String, fileId: Long): PreSignedUrlReadOutput {
        agentWorkspaceService.assertFileReferenceExistsInWorkspace(workspaceId, fileId)
        return filePreviewService.generatePreSignedReadUrl(fileId)
    }

    /** 按显式租户范围验证工作区文件并生成预览地址。 */
    protected fun readWorkspaceFileVersionPreviewUrl(
        tenantId: Long,
        workspaceId: String,
        fileId: Long,
    ): PreSignedUrlReadOutput {
        agentWorkspaceService.assertFileReferenceExistsInWorkspace(tenantId, workspaceId, fileId)
        return filePreviewService.generatePreSignedReadUrl(tenantId, fileId)
    }

    /** 批量读取已通过入口权限校验的知识引用元数据。 */
    protected fun readCitationMetadata(references: List<ReturnedReference>): List<CitationMetadataOutput> {
        val space = CollaborationSpaceContext.getOrNull()
        return if (space == null) {
            knowledgeBaseCitationService.batchGetCitationMetadata(references)
        } else {
            knowledgeBaseCitationService.batchGetCitationMetadata(
                tenantId = TenantContext.getTenantId(),
                spaceId = space.spaceId,
                references = references,
            )
        }
    }

    /** 按显式租户范围批量读取引用元数据。 */
    protected fun readCitationMetadata(
        tenantId: Long,
        references: List<ReturnedReference>,
    ): List<CitationMetadataOutput> = knowledgeBaseCitationService.batchGetCitationMetadata(tenantId, references)

    /** 读取已通过入口权限校验的单条知识引用元数据。 */
    protected fun readCitationMetadata(
        citationType: KnowledgeCitationType,
        referenceId: Long,
    ): CitationMetadataOutput {
        val space = CollaborationSpaceContext.getOrNull()
        return if (space == null) {
            knowledgeBaseCitationService.getCitationMetadata(citationType, referenceId)
        } else {
            knowledgeBaseCitationService.getCitationMetadata(
                tenantId = TenantContext.getTenantId(),
                spaceId = space.spaceId,
                citationType = citationType,
                referenceId = referenceId,
            )
        }
    }

    /** 按显式租户范围读取单条引用元数据。 */
    protected fun readCitationMetadata(
        tenantId: Long,
        citationType: KnowledgeCitationType,
        referenceId: Long,
    ): CitationMetadataOutput = knowledgeBaseCitationService.getCitationMetadata(tenantId, citationType, referenceId)

    /** 按当前登录身份读取根工作区文件和请求会话的非文件制品。 */
    protected fun readWorkspaceArtifacts(
        identity: AgentsConversationIdentity,
        conversationId: String,
        input: WorkspaceFileListInput,
    ): WorkspaceArtifactListOutput = readWorkspaceArtifacts(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        input = input,
    )

    /** 按显式租户范围读取会话工作区制品。 */
    protected fun readWorkspaceArtifacts(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        input: WorkspaceFileListInput,
    ): WorkspaceArtifactListOutput {
        agentsConversationService.assertConversationBelongsToIdentity(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
        )
        val workspaceId = conversationCorrelationQueryService.findRootConversationId(tenantId, conversationId)
        return readWorkspaceArtifacts(
            tenantId = tenantId,
            workspaceId = workspaceId,
            artifactConversationId = conversationId,
            input = input,
        )
    }

    /** 按已验证的根工作区和请求会话读取工作区制品。 */
    protected fun readWorkspaceArtifacts(
        workspaceId: String,
        artifactConversationId: String,
        input: WorkspaceFileListInput,
    ): WorkspaceArtifactListOutput = readWorkspaceArtifacts(
        tenantId = TenantContext.getTenantId(),
        workspaceId = workspaceId,
        artifactConversationId = artifactConversationId,
        input = input,
    )

    /** 按显式租户范围查询根工作区文件和会话制品。 */
    protected fun readWorkspaceArtifacts(
        tenantId: Long,
        workspaceId: String,
        artifactConversationId: String,
        input: WorkspaceFileListInput,
    ): WorkspaceArtifactListOutput {
        val fileArtifacts = agentWorkspaceService.listWorkspaceFiles(
            tenantId = tenantId,
            workspaceId = workspaceId,
            prefix = input.prefix,
            pageable = input.toPageable(),
        ).specification()
        val nonFileArtifacts = workspaceNonFileArtifactQueryService.listActiveArtifactsForTenant(
            tenantId = tenantId,
            workspaceId = artifactConversationId,
        )
            .map { it.toWorkspaceNonFileArtifactOutput() }
        return WorkspaceArtifactListOutput(fileArtifacts = fileArtifacts, nonFileArtifacts = nonFileArtifacts)
    }

    /** 按当前登录身份生成根工作区文件预览 URL。 */
    protected fun readWorkspaceFilePreviewUrl(
        identity: AgentsConversationIdentity,
        conversationId: String,
        path: String,
    ): PreSignedUrlReadOutput = readWorkspaceFilePreviewUrl(
        tenantId = TenantContext.getTenantId(),
        identity = identity,
        conversationId = conversationId,
        path = path,
    )

    /** 按显式租户范围校验会话并生成工作区文件预览地址。 */
    protected fun readWorkspaceFilePreviewUrl(
        tenantId: Long,
        identity: AgentsConversationIdentity,
        conversationId: String,
        path: String,
    ): PreSignedUrlReadOutput {
        agentsConversationService.assertConversationBelongsToIdentity(
            tenantId = tenantId,
            identity = identity,
            conversationId = conversationId,
        )
        val workspaceId = conversationCorrelationQueryService.findRootConversationId(tenantId, conversationId)
        return readWorkspaceFilePreviewUrl(tenantId = tenantId, workspaceId = workspaceId, path = path)
    }

    /** 按已验证的根工作区生成工作区文件预览 URL。 */
    protected fun readWorkspaceFilePreviewUrl(workspaceId: String, path: String): PreSignedUrlReadOutput {
        val fileId = agentWorkspaceService.resolveFileIdByPathOrThrow(workspaceId, path)
        return filePreviewService.generatePreSignedReadUrl(fileId)
    }

    /** 按显式租户范围解析工作区路径并生成预览地址。 */
    protected fun readWorkspaceFilePreviewUrl(
        tenantId: Long,
        workspaceId: String,
        path: String,
    ): PreSignedUrlReadOutput {
        val fileId = agentWorkspaceService.resolveFileIdByPathOrThrow(tenantId, workspaceId, path)
        return filePreviewService.generatePreSignedReadUrl(tenantId, fileId)
    }

    private fun resolveActiveNonFileArtifactPreviewUrls(
        tenantId: Long,
        conversationId: String,
        events: List<AiChatBriefEvent>,
    ): Map<Long, String?> {
        val artifactIds = events.asSequence()
            .filterIsInstance<AiChatEndBriefEvent>()
            .flatMap { event -> event.nonFileArtifacts.asSequence() }
            .mapTo(linkedSetOf()) { artifact -> artifact.artifactId }
        if (artifactIds.isEmpty()) return emptyMap()
        return workspaceNonFileArtifactQueryService.listActiveArtifactsForTenant(
            tenantId,
            conversationId,
            artifactIds,
        )
            .associate { artifact -> artifact.artifactId to artifact.previewUrl }
    }

    private fun refreshNonFileArtifactPreviewUrls(
        events: List<AiChatBriefEvent>,
        previewUrls: Map<Long, String?>,
    ): List<AiChatBriefEvent> = events.map { event ->
        if (event !is AiChatEndBriefEvent) return@map event
        event.copy(
            nonFileArtifacts = event.nonFileArtifacts.map { artifact ->
                artifact.copy(previewUrl = previewUrls[artifact.artifactId])
            },
        )
    }

    private fun contentDisposition(fallbackFileName: String, fileName: String): String {
        val encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20")
        return "attachment; filename=\"$fallbackFileName\"; filename*=UTF-8''$encodedFileName"
    }
}
