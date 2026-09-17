package com.livecommerce.order.api.dto

import com.livecommerce.order.domain.Order
import com.livecommerce.order.domain.OrderStatus
import java.math.BigDecimal
import java.util.UUID

data class OrderResponse(
    val orderId: UUID,
    val status: OrderStatus,
    val amount: BigDecimal,
    val failureReason: String?
) {
    companion object {
        fun from(order: Order): OrderResponse {
            return OrderResponse(order.id, order.status, order.amount, order.failureReason)
        }
    }
}
