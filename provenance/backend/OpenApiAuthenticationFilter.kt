package cc.lingya.xiaolingtong.agents.server.auth

import cc.lingya.xiaolingtong.agents.server.service.OpenApiAccessStore
import cc.lingya.xiaolingtong.agents.server.service.OpenApiChannelAuthorization
import cc.lingya.xiaolingtong.agents.server.service.OpenApiChannelAuthorizationScope
import cc.lingya.xiaolingtong.agents.server.service.OpenApiPreSignedTokenService
import cc.lingya.xiaolingtong.auth.controller.filter.GeneralFilter
import cc.lingya.xiaolingtong.common_util.context.user.OpenApiUserInfo
import cc.lingya.xiaolingtong.common_util.context.user.UserContext
import cc.lingya.xiaolingtong.common_util.exception.HttpStatusException
import cc.lingya.xiaolingtong.common_util.exception.UnauthorizedException
import cc.lingya.xiaolingtong.common_util.restful.specification.CodeMsg
import io.micrometer.core.instrument.MeterRegistry
import jakarta.servlet.DispatcherType
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.redisson.api.RedissonClient
import org.redisson.client.RedisException
import org.redisson.client.codec.StringCodec
import org.springframework.dao.DataAccessResourceFailureException
import org.springframework.transaction.CannotCreateTransactionException
import java.time.Duration

/**
 * 在可信网关租户上下文内验签，异步分派仅恢复当前请求已验证的身份。
 *
 * @author 思追(shaco)
 */
class OpenApiAuthenticationFilter(
    private val access: OpenApiAccessStore,
    private val authorization: OpenApiChannelAuthorization,
    private val tokens: OpenApiPreSignedTokenService,
    private val redis: RedissonClient,
    private val metrics: MeterRegistry,
) : GeneralFilter() {

    /**
     * 在过滤器与签发控制器之间传递已验证凭证的请求属性名。
     *
     * @author 思追(shaco)
     */
    companion object {

        /** 签发接口只读取过滤器写入的已验签凭证。 */
        const val VERIFIED_CREDENTIAL_ATTRIBUTE = "openapi.verified-credential"

        const val VERIFIED_USER_ATTRIBUTE = "openapi.verified-user"
        private const val MAX_BODY_BYTES = 2 * 1024 * 1024
        private const val TOKEN_HEADER = "X-OpenAPI-Token"
        private const val WS_TOKEN_PREFIX = "xlt-openapi-token."
        private val HMAC_HEADERS = listOf("AK", "Timestamp", "Nonce", "User", "Signature")
        private val PATH = Regex("^/api/agents/channel/openapi/v1/([^/]+)/chat(?:/.*)?$")

        /** 读取过滤器在当前请求中写入的已验证 OpenAPI 身份。 */
        fun verifiedUser(request: HttpServletRequest): OpenApiUserInfo? =
            request.getAttribute(VERIFIED_USER_ATTRIBUTE) as? OpenApiUserInfo
    }

    /** 限定认证过滤器的公开路径范围。 */
    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !request.requestURI.startsWith("/api/agents/channel/openapi/")

    /** 验签并在请求期间绑定外部用户身份。 */
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        // 作用域覆盖验签、拦截器和控制器，同一请求只读取一次最新授权状态。
        OpenApiChannelAuthorizationScope.runWithNewScope {
            doFilterInAuthorizationScope(request, response, filterChain)
        }
    }

    /** 在请求级授权作用域内完成验签、身份绑定和后续链路。 */
    private fun doFilterInAuthorizationScope(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        // 在解析前识别认证方式，空值、重复头和混用也必须返回令牌专属错误码。
        val tokenAuthentication = request.getHeaders(TOKEN_HEADER).hasMoreElements() ||
            webSocketTokens(request).isNotEmpty()
        val channelId = PATH.matchEntire(request.requestURI)?.groupValues?.get(1)
        if (channelId == null) {
            writeJsonResponse(response, 401, authenticationFailure(tokenAuthentication, 401))
            return
        }

        val authenticated: Pair<HttpServletRequest, OpenApiUserInfo> = try {
            if (request.dispatcherType == DispatcherType.ASYNC) {
                val user = request.getAttribute(VERIFIED_USER_ATTRIBUTE) as? OpenApiUserInfo
                    ?: throw UnauthorizedException(code = "openapi.unauthorized", message = "OpenAPI 认证失败")
                authorization.assertUser(user, channelId)
                request to user
            } else {
                if (request.getHeader("Content-Encoding") != null) {
                    throw UnauthorizedException(code = "openapi.unauthorized", message = "不支持压缩请求体")
                }

                val body = request.inputStream.readNBytes(MAX_BODY_BYTES + 1)
                if (body.size > MAX_BODY_BYTES) {
                    writeJsonResponse(
                        response,
                        413,
                        CodeMsg("openapi.body.too-large", "请求体超过 2 MiB，请使用文件直传接口"),
                    )
                    return
                }

                val token = bearerToken(request)
                val user = if (token != null) {
                    if (request.requestURI.endsWith("/presign") ||
                        HMAC_HEADERS.any { request.getHeaders("X-OpenAPI-$it").hasMoreElements() }
                    ) {
                        fail()
                    }
                    tokens.verify(token, channelId)
                } else {
                    if (request.requestURI.endsWith("/presign") && body.isNotEmpty()) fail()
                    val signed = OpenApiSignedRequest(
                        accessKey = header(request, "AK"),
                        timestamp = header(request, "Timestamp"),
                        nonce = header(request, "Nonce"),
                        method = request.method,
                        rawPath = request.requestURI,
                        rawQuery = request.queryString.orEmpty(),
                        encodedUser = header(request, "User"),
                        contentType = request.getHeader("Content-Type").orEmpty(),
                        body = body,
                    )
                    val credential = access.credential(channelId, signed.accessKey)
                    val externalUserId = OpenApiSignature.verify(
                        request = signed,
                        signature = header(request, "Signature"),
                        secret = access.secret(credential),
                    )
                    val accepted = redis.getBucket<String>(
                        "openapi:nonce:${signed.accessKey}:${signed.nonce}",
                        StringCodec.INSTANCE,
                    ).setIfAbsent("1", Duration.ofMinutes(10))
                    if (!accepted) {
                        metrics.counter("openapi.authentication.replay").increment()
                        throw UnauthorizedException(code = "openapi.unauthorized", message = "请求已使用，请生成新的 Nonce")
                    }
                    access.user(channelId, credential.clientId, externalUserId).also {
                        request.setAttribute(VERIFIED_CREDENTIAL_ATTRIBUTE, credential)
                    }
                }
                request.setAttribute(VERIFIED_USER_ATTRIBUTE, user)
                OpenApiBodyRequest(request, body) to user
            }
        } catch (error: HttpStatusException) {
            if (error.status.value() == 503) {
                authenticationUnavailable(response, tokenAuthentication)
                return
            }
            metrics.counter("openapi.authentication.rejected").increment()
            if (error.status.value() == 403 || error.status.value() == 404) {
                metrics.counter("openapi.channel.unavailable").increment()
            }
            writeJsonResponse(
                response,
                error.status.value(),
                authenticationFailure(tokenAuthentication, error.status.value()),
            )
            return
        } catch (_: RedisException) {
            authenticationUnavailable(response, tokenAuthentication)
            return
        } catch (_: DataAccessResourceFailureException) {
            authenticationUnavailable(response, tokenAuthentication)
            return
        } catch (_: CannotCreateTransactionException) {
            authenticationUnavailable(response, tokenAuthentication)
            return
        }
        UserContext.runWithContext(authenticated.second) { filterChain.doFilter(authenticated.first, response) }
        if (request.dispatcherType == DispatcherType.REQUEST && authenticated.first.isAsyncStarted) {
            try {
                authenticated.first.asyncContext.addListener(OpenApiAsyncMetricsListener(metrics))
            } catch (_: IllegalStateException) {
                // 快速完成的异步响应可能已结束，容器不再接受监听器。
                logger.debug("OpenAPI 异步响应已完成，跳过传输监听器注册")
            }
        }
    }

    private fun header(request: HttpServletRequest, suffix: String): String {
        val values = request.getHeaders("X-OpenAPI-$suffix").toList()
        if (values.size != 1 ||
            values[0].length > 512
        ) {
            throw UnauthorizedException(code = "openapi.unauthorized", message = "OpenAPI 认证失败")
        }
        return values[0]
    }

    private fun bearerToken(request: HttpServletRequest): String? {
        val values = request.getHeaders(TOKEN_HEADER).toList()
        if (values.size > 1) fail()
        val wsTokens = webSocketTokens(request)
        if (wsTokens.size > 1 || (values.isNotEmpty() && wsTokens.isNotEmpty())) fail()
        return (values.singleOrNull() ?: wsTokens.singleOrNull())?.also {
            if (it.isBlank()) fail()
        }
    }

    private fun webSocketTokens(request: HttpServletRequest): List<String> =
        if (request.requestURI.endsWith("/stream/ws") &&
            request.getHeader("Upgrade").equals("websocket", ignoreCase = true)
        ) {
            request.getHeaders("Sec-WebSocket-Protocol").toList()
                .flatMap { it.split(',') }
                .map(String::trim)
                .filter { it.startsWith(WS_TOKEN_PREFIX) }
                .map { it.removePrefix(WS_TOKEN_PREFIX) }
        } else {
            emptyList()
        }

    private fun authenticationFailure(tokenAuthentication: Boolean, status: Int): CodeMsg = when {
        status == 503 && tokenAuthentication -> CodeMsg("openapi.token.unavailable", "短期令牌认证暂不可用")
        status == 503 -> CodeMsg("openapi.authentication.unavailable", "认证服务暂不可用")
        tokenAuthentication -> CodeMsg("openapi.token.invalid", "短期令牌不可用")
        else -> CodeMsg("openapi.authentication.failed", "OpenAPI 认证失败或渠道不可用")
    }

    private fun authenticationUnavailable(response: HttpServletResponse, tokenAuthentication: Boolean) {
        metrics.counter("openapi.authentication.unavailable").increment()
        logger.error(if (tokenAuthentication) "OpenAPI 短期令牌认证存储不可用" else "OpenAPI AK/SK 认证存储不可用")
        writeJsonResponse(response, 503, authenticationFailure(tokenAuthentication, 503))
    }

    private fun fail(): Nothing = throw UnauthorizedException(code = "openapi.unauthorized", message = "OpenAPI 认证失败")
}
