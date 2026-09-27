package com.livecommerce.order.admin

import com.livecommerce.order.domain.Order
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class AdminOrderView(
    val orderId: UUID,
    val memberId: UUID,
    val productId: UUID,
    val quantity: Int,
    val amount: BigDecimal?,
    val status: String,
    val failureReason: String?,
    val retryCount: Int,
    val paymentDeadline: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant
) {
    companion object {
        fun from(order: Order): AdminOrderView {
            return AdminOrderView(
                orderId = order.id,
                memberId = order.memberId,
                productId = order.productId,
                quantity = order.quantity,
                amount = order.amount,
                status = order.status.name,
                failureReason = order.failureReason,
                retryCount = order.retryCount,
                paymentDeadline = order.paymentDeadline,
                createdAt = order.createdAt,
                updatedAt = order.updatedAt
            )
        }
    }
}

data class AdminPage<T>(
    val items: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int
)

data class MinuteBucket(
    val minute: Instant,
    val created: Long,
    val completed: Long
)

data class OrderSummary(
    val countsByStatus: Map<String, Long>,
    val completedRevenue: BigDecimal,
    val ordersLast24h: Long,
    val completedLast24h: Long,
    val stalledOrders: Long,
    val averageCompletionSeconds: Double?,
    val ordersPerMinute: List<MinuteBucket>
)

data class AdminErrorResponse(
    val code: String,
    val message: String
)
