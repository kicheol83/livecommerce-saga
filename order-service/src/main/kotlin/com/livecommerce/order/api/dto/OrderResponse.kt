package com.livecommerce.order.api.dto

import com.livecommerce.common.shipping.ShippingAddress
import com.livecommerce.order.domain.Order
import com.livecommerce.order.domain.OrderStatus
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class OrderResponse(
    val orderId: UUID,
    val productId: UUID,
    val status: OrderStatus,
    val quantity: Int,
    val amount: BigDecimal?,
    val paymentDeadline: Instant?,
    val failureReason: String?,
    val shippingAddress: ShippingAddress?,
    val createdAt: Instant
) {
    companion object {
        fun from(order: Order): OrderResponse {
            return OrderResponse(
                orderId = order.id,
                productId = order.productId,
                status = order.status,
                quantity = order.quantity,
                amount = order.amount,
                paymentDeadline = order.paymentDeadline,
                failureReason = order.failureReason,
                shippingAddress = order.shippingAddress(),
                createdAt = order.createdAt
            )
        }
    }
}
