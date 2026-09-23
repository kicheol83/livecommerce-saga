package com.livecommerce.inventory.api.dto

import java.util.UUID

data class ReleaseInventoryRequest(
    val orderId: UUID
)
