package cc.lingya.xiaolingtong.agents.server.service.impl

import cc.lingya.xiaolingtong.agentruntime.model.po.OpenApiCredentialPo
import cc.lingya.xiaolingtong.agents.server.model.OpenApiPreSignedTokenPayload
import cc.lingya.xiaolingtong.agents.server.model.dto.output.OpenApiPreSignedTokenOutput
import cc.lingya.xiaolingtong.agents.server.service.OpenApiAccessStore
import cc.lingya.xiaolingtong.agents.server.service.OpenApiChannelAuthorization
import cc.lingya.xiaolingtong.agents.server.service.OpenApiPreSignedTokenService
import cc.lingya.xiaolingtong.common_util.context.tenant.TenantContext
import cc.lingya.xiaolingtong.common_util.context.user.OpenApiUserInfo
import cc.lingya.xiaolingtong.common_util.exception.InternalServerErrorException
import cc.lingya.xiaolingtong.common_util.exception.ServiceUnavailableException
import cc.lingya.xiaolingtong.common_util.exception.UnauthorizedException
import cc.lingya.xiaolingtong.common_util.utils.hmacSha256
import cc.lingya.xiaolingtong.common_util.utils.json.DecodeException
import cc.lingya.xiaolingtong.common_util.utils.json.Json
import cc.lingya.xiaolingtong.common_util.utils.sha256
import cc.lingya.xiaolingtong.common_util.utils.toBase64UrlNoPadding
import io.github.oshai.kotlinlogging.KotlinLogging
import org.redisson.api.RedissonClient
import org.redisson.client.RedisException
import org.redisson.client.codec.StringCodec
import org.springframework.dao.DataAccessResourceFailureException
import org.springframework.stereotype.Service
import org.springframework.transaction.CannotCreateTransactionException
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Duration
import java.time.Instant
import java.util.Base64

/**
 * 验证短期令牌及实时授权，并通过 Redis 原子消费保证跨实例只能使用一次。
 *
 * @author 思追(shaco)
 */
@Service
class OpenApiPreSignedTokenServiceImpl(
    private val access: OpenApiAccessStore,
    private val authorization: OpenApiChannelAuthorization,
    private val redis: RedissonClient,
) : OpenApiPreSignedTokenService {

    private companion object {

        val log = KotlinLogging.logger {}
        const val VERSION = "op1"
        const val AUDIENCE = "agents-openapi-chat"
        const val SIGNING_DOMAIN = "OPENAPI-PRESIGN-HS256-V1\n"
        const val TTL_SECONDS = 600L
        const val MAX_TOKEN_LENGTH = 2048
        const val MAX_PAYLOAD_BYTES = 1024
        val RANDOM = SecureRandom()
        val BASE64URL = Regex("[A-Za-z0-9_-]+")
    }

    /** 仅对已验签身份签发一次性令牌，存储失败时不返回令牌。 */
    override fun issue(credential: OpenApiCredentialPo, user: OpenApiUserInfo): OpenApiPreSignedTokenOutput =
        issue(credential, user, Instant.now())

    /** 使用指定时刻签发令牌，供有效期边界测试使用。 */
    fun issue(credential: OpenApiCredentialPo, user: OpenApiUserInfo, now: Instant,): OpenApiPreSignedTokenOutput =
        try {
            issueStoredToken(credential, user, now)
        } catch (_: RedisException) {
            throw ServiceUnavailableException(code = "openapi.token.issue.unavailable", message = "短期令牌签发暂不可用")
        } catch (_: DataAccessResourceFailureException) {
            throw ServiceUnavailableException(code = "openapi.token.issue.unavailable", message = "短期令牌签发暂不可用")
        } catch (_: CannotCreateTransactionException) {
            throw ServiceUnavailableException(code = "openapi.token.issue.unavailable", message = "短期令牌签发暂不可用")
        } catch (_: ServiceUnavailableException) {
            throw ServiceUnavailableException(code = "openapi.token.issue.unavailable", message = "短期令牌签发暂不可用")
        } catch (error: Exception) {
            // 仅记录类型，避免第三方异常消息携带签发凭据。
            log.error { "短期令牌签发失败，异常类型：${error.javaClass.simpleName}" }
            throw InternalServerErrorException(code = "openapi.token.issue.failed", message = "短期令牌签发失败")
        }

    private fun issueStoredToken(
        credential: OpenApiCredentialPo,
        user: OpenApiUserInfo,
        now: Instant,
    ): OpenApiPreSignedTokenOutput {
        if (credential.tenantId != user.tenantId || credential.clientId != user.clientId) fail()
        authorization.assertUser(user, user.channelId)
        val issuedAt = now.epochSecond
        val payload = OpenApiPreSignedTokenPayload(
            version = 1,
            audience = AUDIENCE,
            accessKey = credential.accessKey,
            tenantId = user.tenantId,
            channelId = user.channelId,
            clientId = user.clientId,
            userId = user.userId,
            issuedAt = issuedAt,
            expiresAt = issuedAt + TTL_SECONDS,
            jti = ByteArray(16).also(RANDOM::nextBytes).toBase64UrlNoPadding(),
        )
        val encoded = Json.encode(payload).toByteArray(Charsets.UTF_8).toBase64UrlNoPadding()
        val signedPart = "$VERSION.$encoded"
        val signature = sign(signedPart, access.secret(credential))
        val token = "$signedPart.$signature"
        val expiresAt = Instant.ofEpochSecond(payload.expiresAt)
        // 写值与 TTL 必须同一次完成，未使用的令牌也能自动回收。
        redis.getBucket<String>(storageKey(payload), StringCodec.INSTANCE)
            .set(token.sha256(), Duration.between(now, expiresAt))
        return OpenApiPreSignedTokenOutput(token, expiresAt)
    }

    /** 验证最新授权并消费令牌；业务失败不退还，异步分派应复用请求身份。 */
    override fun verify(token: String, channelId: String): OpenApiUserInfo = verify(token, channelId, Instant.now())

    /** 使用指定时刻验证并消费令牌，供边界测试和请求认证共用。 */
    fun verify(token: String, channelId: String, now: Instant): OpenApiUserInfo {
        val parts = token.split('.')
        if (token.length > MAX_TOKEN_LENGTH || parts.size != 3 || parts[0] != VERSION) fail()
        val payloadBytes = decode(parts[1], MAX_PAYLOAD_BYTES)
        val signature = decode(parts[2], 32)
        if (signature.size != 32) fail()
        val payload = try {
            Json.decodeValue<OpenApiPreSignedTokenPayload>(String(payloadBytes, Charsets.UTF_8))
        } catch (_: DecodeException) {
            fail()
        }

        // AK 仅用于定位密钥；直到签名比较成功，payload 的其他字段均不可信。
        val credential = access.credential(channelId, payload.accessKey)
        val expected = hmacSha256(
            (SIGNING_DOMAIN + parts[0] + "." + parts[1]).toByteArray(Charsets.UTF_8),
            access.secret(credential).toByteArray(Charsets.UTF_8),
        )
        if (!MessageDigest.isEqual(expected, signature)) fail()
        if (payload.version != 1 || payload.audience != AUDIENCE ||
            payload.tenantId != TenantContext.getTenantId() || payload.channelId != channelId ||
            payload.clientId != credential.clientId || payload.userId <= 0 ||
            payload.issuedAt > now.epochSecond + 30 ||
            payload.expiresAt - payload.issuedAt != TTL_SECONDS ||
            now.epochSecond >= payload.expiresAt ||
            payload.jti.length != 22 || !BASE64URL.matches(payload.jti)
        ) {
            fail()
        }
        val user = OpenApiUserInfo(
            tenantId = payload.tenantId,
            userId = payload.userId,
            channelId = payload.channelId,
            clientId = payload.clientId,
        )
            .also { authorization.assertUser(it, channelId) }
        // 先完成全部校验再原子删除，避免并发放行或失败请求抢占合法令牌。
        val stored = redis.getBucket<String>(storageKey(payload), StringCodec.INSTANCE).getAndDelete()
        if (stored == null || stored != token.sha256()) fail()
        return user
    }

    private fun storageKey(payload: OpenApiPreSignedTokenPayload): String =
        "openapi:presign:${payload.tenantId}:${payload.channelId}:${payload.jti}"

    private fun sign(value: String, secret: String): String =
        hmacSha256((SIGNING_DOMAIN + value).toByteArray(Charsets.UTF_8), secret.toByteArray(Charsets.UTF_8))
            .toBase64UrlNoPadding()

    private fun decode(value: String, maxBytes: Int): ByteArray {
        if (value.isEmpty() || value.length > maxBytes * 2 || !BASE64URL.matches(value)) fail()
        val bytes = try {
            Base64.getUrlDecoder().decode(value)
        } catch (_: IllegalArgumentException) {
            fail()
        }
        if (bytes.size > maxBytes || bytes.toBase64UrlNoPadding() != value) fail()
        return bytes
    }

    private fun fail(): Nothing = throw UnauthorizedException(code = "openapi.token.invalid", message = "短期令牌不可用")
}
