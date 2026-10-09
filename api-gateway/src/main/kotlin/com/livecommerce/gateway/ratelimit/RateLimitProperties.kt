package com.livecommerce.gateway.ratelimit

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "gateway.rate-limit")
data class RateLimitProperties(
    val enabled: Boolean = true,
    val login: Limit = Limit(10, Duration.ofMinutes(1)),
    val signup: Limit = Limit(5, Duration.ofHours(1)),
    val orders: Limit = Limit(20, Duration.ofMinutes(1))
) {
    data class Limit(val requests: Int, val window: Duration)
}
