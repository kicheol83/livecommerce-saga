package com.livecommerce.gateway.ratelimit

import java.time.Clock
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

class FixedWindowRateLimiter(private val clock: Clock = Clock.systemUTC()) {

    private val windows = ConcurrentHashMap<String, Window>()
    private val calls = AtomicLong()

    fun tryAcquire(key: String, limit: RateLimitProperties.Limit): Decision {
        val now = clock.millis()
        val windowMillis = limit.window.toMillis()
        val window = windows.compute(key) { _, current ->
            if (current == null || now - current.startedAt >= current.lengthMillis) {
                Window(now, windowMillis, 1)
            } else {
                current.copy(count = current.count + 1)
            }
        }!!
        if (calls.incrementAndGet() % EVICT_EVERY_CALLS == 0L) {
            windows.entries.removeIf { now - it.value.startedAt >= it.value.lengthMillis }
        }
        if (window.count <= limit.requests) {
            return Decision.Allowed
        }
        return Decision.Rejected(Duration.ofMillis(window.startedAt + window.lengthMillis - now))
    }

    fun trackedKeys(): Int {
        return windows.size
    }

    sealed interface Decision {
        data object Allowed : Decision
        data class Rejected(val retryAfter: Duration) : Decision
    }

    private data class Window(val startedAt: Long, val lengthMillis: Long, val count: Int)

    companion object {
        private const val EVICT_EVERY_CALLS = 1_000L
    }
}
