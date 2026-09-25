package com.livecommerce.common.events

import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class InventoryReservedEvent(
    val orderId: UUID,
    val reservationId: UUID,
    val productId: UUID,
    val quantity: Int,
    val unitPrice: BigDecimal,
    val expiresAt: Instant
)

data class InventoryFailedEvent(
    val orderId: UUID,
    val reason: String
)

data class InventoryConfirmedEvent(
    val orderId: UUID,
    val reservationId: UUID
)

data class InventoryConfirmFailedEvent(
    val orderId: UUID,
    val reason: String
)
