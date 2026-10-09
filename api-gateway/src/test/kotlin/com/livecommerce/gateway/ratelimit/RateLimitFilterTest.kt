package com.livecommerce.gateway.ratelimit

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.net.InetSocketAddress
import java.security.Principal
import java.time.Duration

class RateLimitFilterTest {

    private val properties = RateLimitProperties(
        login = RateLimitProperties.Limit(2, Duration.ofMinutes(1)),
        signup = RateLimitProperties.Limit(1, Duration.ofHours(1)),
        orders = RateLimitProperties.Limit(2, Duration.ofMinutes(1))
    )
    private val filter = RateLimitFilter(properties)
    private val chain = CountingChain()

    @Test
    fun `answers 429 with Retry-After once one address exceeds the login limit`() {
        val statuses = (1..3).map { send(post("/api/auth/login", "203.0.113.7")) }

        assertThat(statuses.take(2)).allMatch { it.response.statusCode == null }
        val rejected = statuses.last().response
        assertThat(rejected.statusCode).isEqualTo(HttpStatus.TOO_MANY_REQUESTS)
        assertThat(rejected.headers.getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("60")
        assertThat(rejected.bodyAsString.block()).contains("RATE_LIMITED")
        assertThat(chain.calls).isEqualTo(2)
    }

    @Test
    fun `a spoofed X-Forwarded-For value does not give a fresh allowance`() {
        send(post("/api/auth/signup", "203.0.113.7"))

        val spoofed = send(post("/api/auth/signup", "203.0.113.7", spoofed = "1.1.1.1"))

        assertThat(spoofed.response.statusCode).isEqualTo(HttpStatus.TOO_MANY_REQUESTS)
    }

    @Test
    fun `limits order creation per signed-in user rather than per address`() {
        val alice = (1..3).map { send(post("/api/orders", "203.0.113.7"), principal = "alice") }
        val bob = send(post("/api/orders", "203.0.113.7"), principal = "bob")

        assertThat(alice.last().response.statusCode).isEqualTo(HttpStatus.TOO_MANY_REQUESTS)
        assertThat(bob.response.statusCode).isNull()
    }

    @Test
    fun `leaves other routes and internal callers alone`() {
        repeat(5) { send(post("/api/orders/abc/payment", "203.0.113.7"), principal = "alice") }
        repeat(5) { send(post("/api/auth/login", null)) }

        assertThat(chain.calls).isEqualTo(10)
    }

    @Test
    fun `does nothing when disabled`() {
        val disabled = RateLimitFilter(properties.copy(enabled = false))
        repeat(5) { disabled.filter(post("/api/auth/login", "203.0.113.7"), chain).block() }

        assertThat(chain.calls).isEqualTo(5)
    }

    private fun post(path: String, client: String?, spoofed: String? = null): ServerWebExchange {
        val forwarded = listOfNotNull(spoofed, client, "172.18.0.2").joinToString(", ")
        val request = MockServerHttpRequest.post(path)
            .header("X-Forwarded-For", forwarded)
            .remoteAddress(InetSocketAddress("172.18.0.5", 40000))
            .build()
        return MockServerWebExchange.from(request)
    }

    private fun send(exchange: ServerWebExchange, principal: String? = null): MockServerWebExchange {
        val withPrincipal = if (principal == null) exchange else exchange.mutate().principal(Mono.just(Principal { principal })).build()
        filter.filter(withPrincipal, chain).block()
        return exchange as MockServerWebExchange
    }

    private class CountingChain : GatewayFilterChain {
        var calls = 0

        override fun filter(exchange: ServerWebExchange): Mono<Void> {
            calls += 1
            return Mono.empty()
        }
    }
}
