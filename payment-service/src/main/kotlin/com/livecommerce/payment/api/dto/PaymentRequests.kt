package com.livecommerce.payment.api.dto

import java.math.BigDecimal
import java.util.UUID

data class ReservePaymentRequest(
    val orderId: UUID,
    val memberId: UUID,
    val amount: BigDecimal
)

data class CancelPaymentRequest(
    val orderId: UUID
)
