package com.livecommerce.common.events

import com.livecommerce.common.shipping.ShippingAddress
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class OrderCompletedEvent(
    val orderId: UUID,
    val memberId: UUID,
    val productId: UUID,
    val quantity: Int,
    val amount: BigDecimal,
    val shippingAddress: ShippingAddress,
    val completedAt: Instant
)
