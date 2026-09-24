package com.livecommerce.order.api.dto

import java.math.BigDecimal
import java.util.UUID

data class CreateOrderRequest(
    val productId: UUID,
    val quantity: Int,
    val amount: BigDecimal
)
