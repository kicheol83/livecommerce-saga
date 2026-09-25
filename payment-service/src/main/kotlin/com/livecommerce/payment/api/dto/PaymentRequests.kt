package com.livecommerce.payment.api.dto

import java.math.BigDecimal
import java.util.UUID

data class ConfirmPaymentRequest(
    val orderId: UUID,
    val memberId: UUID,
    val paymentKey: String,
    val amount: BigDecimal
)

data class ConfirmPaymentResponse(
    val orderId: UUID,
    val status: String
)

data class CancelPaymentRequest(
    val orderId: UUID,
    val reason: String = "saga compensation"
)
