package com.livecommerce.common.events

import java.util.UUID

data class InventoryReservedEvent(
    val orderId: UUID,
    val reservationId: UUID,
    val productId: UUID,
    val quantity: Int
)

data class InventoryFailedEvent(
    val orderId: UUID,
    val reason: String
)
