package com.livecommerce.gateway.ratelimit

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

class FixedWindowRateLimiterTest {

    private val clock = MutableClock()
    private val limiter = FixedWindowRateLimiter(clock)
    private val limit = RateLimitProperties.Limit(3, Duration.ofMinutes(1))

    @Test
    fun `allows requests up to the limit and rejects the next one with the remaining wait`() {
        repeat(3) { assertThat(limiter.tryAcquire("login:1.2.3.4", limit)).isEqualTo(FixedWindowRateLimiter.Decision.Allowed) }
        clock.advance(Duration.ofSeconds(20))

        val decision = limiter.tryAcquire("login:1.2.3.4", limit)

        assertThat(decision).isEqualTo(FixedWindowRateLimiter.Decision.Rejected(Duration.ofSeconds(40)))
    }

    @Test
    fun `counts each key separately`() {
        repeat(3) { limiter.tryAcquire("login:1.2.3.4", limit) }

        assertThat(limiter.tryAcquire("login:5.6.7.8", limit)).isEqualTo(FixedWindowRateLimiter.Decision.Allowed)
        assertThat(limiter.tryAcquire("login:1.2.3.4", limit)).isInstanceOf(FixedWindowRateLimiter.Decision.Rejected::class.java)
    }

    @Test
    fun `starts a new window once the old one has passed`() {
        repeat(4) { limiter.tryAcquire("signup:1.2.3.4", limit) }
        clock.advance(Duration.ofMinutes(1))

        assertThat(limiter.tryAcquire("signup:1.2.3.4", limit)).isEqualTo(FixedWindowRateLimiter.Decision.Allowed)
    }

    @Test
    fun `forgets expired keys so memory does not grow with every address seen`() {
        repeat(999) { limiter.tryAcquire("login:10.0.0.$it", limit) }
        clock.advance(Duration.ofMinutes(2))

        limiter.tryAcquire("login:1.2.3.4", limit)

        assertThat(limiter.trackedKeys()).isEqualTo(1)
    }

    private class MutableClock(private var now: Instant = Instant.parse("2026-10-10T00:00:00Z")) : Clock() {
        fun advance(duration: Duration) {
            now = now.plus(duration)
        }

        override fun instant(): Instant = now

        override fun getZone(): ZoneId = ZoneOffset.UTC

        override fun withZone(zone: ZoneId): Clock = this
    }
}
