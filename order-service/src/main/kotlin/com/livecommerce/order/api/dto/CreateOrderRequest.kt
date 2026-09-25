package com.livecommerce.order.api.dto

import java.math.BigDecimal
import java.util.UUID

data class CreateOrderRequest(
    val productId: UUID,
    val quantity: Int
)

data class SubmitPaymentRequest(
    val paymentKey: String,
    val amount: BigDecimal
)

data class OrderErrorResponse(
    val code: String,
    val message: String
)
