package com.livecommerce.common.events

import java.math.BigDecimal
import java.util.UUID

data class PaymentReservedEvent(
    val orderId: UUID,
    val paymentId: UUID,
    val amount: BigDecimal
)

data class PaymentConfirmedEvent(
    val orderId: UUID,
    val paymentId: UUID,
    val amount: BigDecimal
)

data class PaymentFailedEvent(
    val orderId: UUID,
    val reason: String
)

data class PaymentCancelledEvent(
    val orderId: UUID,
    val paymentId: UUID?
)
