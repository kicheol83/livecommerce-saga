package com.livecommerce.gateway.ratelimit

import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.security.Principal

@Component
class RateLimitFilter(private val properties: RateLimitProperties) : GlobalFilter, Ordered {

    private val limiter = FixedWindowRateLimiter()

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val request = exchange.request
        if (!properties.enabled || request.method != HttpMethod.POST) {
            return chain.filter(exchange)
        }
        return when (request.path.pathWithinApplication().value()) {
            LOGIN_PATH -> byAddress(exchange, chain, "login", properties.login)
            SIGNUP_PATH -> byAddress(exchange, chain, "signup", properties.signup)
            ORDERS_PATH -> byUser(exchange, chain)
            else -> chain.filter(exchange)
        }
    }

    override fun getOrder(): Int {
        return Ordered.HIGHEST_PRECEDENCE + 1
    }

    private fun byAddress(
        exchange: ServerWebExchange,
        chain: GatewayFilterChain,
        rule: String,
        limit: RateLimitProperties.Limit
    ): Mono<Void> {
        val address = ClientAddress.resolve(exchange.request) ?: return chain.filter(exchange)
        return enforce(exchange, chain, "$rule:$address", limit)
    }

    private fun byUser(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        return exchange.getPrincipal<Principal>()
            .map { "orders:${it.name}" }
            .defaultIfEmpty("")
            .flatMap { key ->
                if (key.isEmpty()) chain.filter(exchange) else enforce(exchange, chain, key, properties.orders)
            }
    }

    private fun enforce(
        exchange: ServerWebExchange,
        chain: GatewayFilterChain,
        key: String,
        limit: RateLimitProperties.Limit
    ): Mono<Void> {
        return when (val decision = limiter.tryAcquire(key, limit)) {
            FixedWindowRateLimiter.Decision.Allowed -> chain.filter(exchange)
            is FixedWindowRateLimiter.Decision.Rejected -> reject(exchange, decision)
        }
    }

    private fun reject(exchange: ServerWebExchange, decision: FixedWindowRateLimiter.Decision.Rejected): Mono<Void> {
        val response = exchange.response
        val retryAfterSeconds = maxOf(1L, (decision.retryAfter.toMillis() + 999) / 1000)
        response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS)
        response.headers.contentType = MediaType.APPLICATION_JSON
        response.headers.set(HttpHeaders.RETRY_AFTER, retryAfterSeconds.toString())
        val body = """{"code":"RATE_LIMITED","message":"Too many requests, try again in $retryAfterSeconds seconds"}"""
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body.toByteArray())))
    }

    companion object {
        const val LOGIN_PATH = "/api/auth/login"
        const val SIGNUP_PATH = "/api/auth/signup"
        const val ORDERS_PATH = "/api/orders"
    }
}
