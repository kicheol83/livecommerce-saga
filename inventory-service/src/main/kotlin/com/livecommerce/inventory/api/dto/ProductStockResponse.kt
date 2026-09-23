package com.livecommerce.inventory.api.dto

import java.util.UUID

data class ProductStockResponse(
    val productId: UUID,
    val quantityAvailable: Int
)
