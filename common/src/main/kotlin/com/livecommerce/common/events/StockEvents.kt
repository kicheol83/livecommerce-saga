package com.livecommerce.common.events

import java.util.UUID

data class StockChangedEvent(
    val productId: UUID,
    val quantityAvailable: Int
)
