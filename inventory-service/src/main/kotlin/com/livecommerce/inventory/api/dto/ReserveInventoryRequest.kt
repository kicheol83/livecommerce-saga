package com.livecommerce.inventory.api.dto

import java.util.UUID

data class ReserveInventoryRequest(
    val orderId: UUID,
    val productId: UUID,
    val quantity: Int
)
