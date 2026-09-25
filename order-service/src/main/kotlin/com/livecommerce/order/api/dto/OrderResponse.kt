package com.livecommerce.order.api.dto

import com.livecommerce.order.domain.Order
import com.livecommerce.order.domain.OrderStatus
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class OrderResponse(
    val orderId: UUID,
    val status: OrderStatus,
    val quantity: Int,
    val amount: BigDecimal?,
    val paymentDeadline: Instant?,
    val failureReason: String?
) {
    companion object {
        fun from(order: Order): OrderResponse {
            return OrderResponse(order.id, order.status, order.quantity, order.amount, order.paymentDeadline, order.failureReason)
        }
    }
}
