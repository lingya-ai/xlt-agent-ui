package cc.lingya.xiaolingtong.agents.server.service

import cc.lingya.xiaolingtong.agentruntime.model.po.OpenApiCredentialPo
import cc.lingya.xiaolingtong.agents.server.model.dto.output.OpenApiPreSignedTokenOutput
import cc.lingya.xiaolingtong.common_util.context.user.OpenApiUserInfo

/**
 * 为已验签的渠道用户签发十分钟内有效的一次性令牌，并在消费时校验最新授权。
 *
 * @author 思追(shaco)
 */
interface OpenApiPreSignedTokenService {

    /** 使用已验证的 AK 凭证和用户身份签发令牌，持久化带 TTL 的消费记录后返回。 */
    fun issue(credential: OpenApiCredentialPo, user: OpenApiUserInfo): OpenApiPreSignedTokenOutput

    /** 验证并原子消费令牌，返回当前渠道身份；后续业务失败也不恢复令牌。 */
    fun verify(token: String, channelId: String): OpenApiUserInfo
}
