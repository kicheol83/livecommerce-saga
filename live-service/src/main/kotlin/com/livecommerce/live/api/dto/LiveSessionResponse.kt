package com.livecommerce.live.api.dto

import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class LiveSessionResponse(
    val sessionId: String,
    val title: String,
    val hostName: String,
    val productId: UUID,
    val productName: String,
    val price: BigDecimal,
    val originalPrice: BigDecimal,
    val stock: Int?,
    val endsAt: Instant,
    val viewerCount: Int
)
