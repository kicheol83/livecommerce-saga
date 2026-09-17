package com.livecommerce.common.events

import java.math.BigDecimal
import java.util.UUID

data class OrderCreatedEvent(
    val orderId: UUID,
    val memberId: UUID,
    val productId: UUID,
    val quantity: Int,
    val amount: BigDecimal
)
