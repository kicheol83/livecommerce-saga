package com.livecommerce.live.auth

import org.slf4j.LoggerFactory
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtException

class StompAuthenticationInterceptor(
    private val jwtDecoder: JwtDecoder
) : ChannelInterceptor {

    private val log = LoggerFactory.getLogger(StompAuthenticationInterceptor::class.java)

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*> {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java) ?: return message
        if (accessor.command != StompCommand.CONNECT) {
            return message
        }
        val header = accessor.getFirstNativeHeader(AUTHORIZATION_HEADER) ?: return message
        if (!header.startsWith(BEARER_PREFIX)) {
            return message
        }
        try {
            val jwt = jwtDecoder.decode(header.removePrefix(BEARER_PREFIX))
            val nickname = jwt.getClaimAsString(NICKNAME_CLAIM)
            if (!nickname.isNullOrBlank()) {
                accessor.user = LiveUser(jwt.subject, nickname)
            }
        } catch (ex: JwtException) {
            log.debug("Rejected STOMP token: {}", ex.message)
        }
        return message
    }

    companion object {
        private const val AUTHORIZATION_HEADER = "Authorization"
        private const val BEARER_PREFIX = "Bearer "
        private const val NICKNAME_CLAIM = "nickname"
    }
}
