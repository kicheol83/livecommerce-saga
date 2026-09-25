package com.livecommerce.inventory.api.dto

import java.math.BigDecimal
import java.util.UUID

data class ProductStockResponse(
    val productId: UUID,
    val quantityAvailable: Int,
    val unitPrice: BigDecimal
)
