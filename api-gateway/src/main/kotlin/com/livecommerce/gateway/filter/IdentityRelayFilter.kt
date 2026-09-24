package com.livecommerce.gateway.filter

import com.livecommerce.common.identity.IdentityHeaders
import com.livecommerce.gateway.config.SecurityConfig
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.security.Principal

@Component
class IdentityRelayFilter : GlobalFilter, Ordered {

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val stripped = exchange.mutate()
            .request { request ->
                request.headers { headers ->
                    headers.remove(IdentityHeaders.USER_ID)
                    headers.remove(IdentityHeaders.USER_ROLES)
                }
            }
            .build()
        return exchange.getPrincipal<Principal>()
            .ofType(JwtAuthenticationToken::class.java)
            .map { authentication -> withIdentity(stripped, authentication) }
            .defaultIfEmpty(stripped)
            .flatMap { chain.filter(it) }
    }

    override fun getOrder(): Int {
        return Ordered.HIGHEST_PRECEDENCE
    }

    private fun withIdentity(exchange: ServerWebExchange, authentication: JwtAuthenticationToken): ServerWebExchange {
        val roles = authentication.authorities
            .mapNotNull { it.authority }
            .filter { it.startsWith(SecurityConfig.ROLE_PREFIX) }
            .joinToString(",") { it.removePrefix(SecurityConfig.ROLE_PREFIX) }
        return exchange.mutate()
            .request { request ->
                request.header(IdentityHeaders.USER_ID, authentication.token.subject)
                request.header(IdentityHeaders.USER_ROLES, roles)
            }
            .build()
    }
}
