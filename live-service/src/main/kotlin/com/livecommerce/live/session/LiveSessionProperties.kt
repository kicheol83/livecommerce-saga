package com.livecommerce.live.session

import org.springframework.boot.context.properties.ConfigurationProperties
import java.math.BigDecimal
import java.util.UUID

@ConfigurationProperties(prefix = "live.session")
data class LiveSessionProperties(
    val id: String,
    val title: String,
    val hostName: String,
    val productId: UUID,
    val productName: String,
    val price: BigDecimal,
    val originalPrice: BigDecimal,
    val durationMinutes: Long
)
