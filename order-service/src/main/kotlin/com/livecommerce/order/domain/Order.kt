package com.livecommerce.order.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "orders")
class Order(
    @Id
    val id: UUID,

    @Column(name = "member_id", nullable = false)
    val memberId: UUID,

    @Column(name = "product_id", nullable = false)
    val productId: UUID,

    @Column(nullable = false)
    val quantity: Int,

    @Column(nullable = false)
    val amount: BigDecimal,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: OrderStatus,

    @Column(name = "failure_reason")
    var failureReason: String? = null,

    @Column(name = "retry_count", nullable = false)
    var retryCount: Int = 0,

    @Version
    var version: Long = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
) {
    fun markPaymentConfirmed() {
        status = OrderStatus.PAYMENT_CONFIRMED
        touch()
    }

    fun markAwaitingInventory() {
        status = OrderStatus.AWAITING_INVENTORY
        retryCount = 0
        touch()
    }

    fun markCompleted() {
        status = OrderStatus.COMPLETED
        touch()
    }

    fun markCompensating(reason: String) {
        status = OrderStatus.COMPENSATING
        failureReason = reason
        retryCount = 0
        touch()
    }

    fun markCancelled(reason: String) {
        status = OrderStatus.CANCELLED
        failureReason = reason
        touch()
    }

    fun recordRetry() {
        retryCount += 1
        touch()
    }

    private fun touch() {
        updatedAt = Instant.now()
    }
}
