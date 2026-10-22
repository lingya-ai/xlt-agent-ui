package cc.lingya.xiaolingtong.agents.server.model.dto.output

import java.time.Instant

/**
 * 返回给接入方的一次性渠道令牌，截止前仅能认证一个新请求；日志不得输出令牌原文。
 *
 * @author 思追(shaco)
 */
data class OpenApiPreSignedTokenOutput(
    val token: String,
    val expiresAt: Instant,
) {

    /** 防止响应对象被意外记录时泄露 bearer 凭据。 */
    override fun toString(): String = "OpenApiPreSignedTokenOutput(token=[redacted], expiresAt=$expiresAt)"
}
