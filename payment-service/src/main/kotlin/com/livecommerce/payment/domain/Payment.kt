package com.livecommerce.payment.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "payments", uniqueConstraints = [UniqueConstraint(columnNames = ["order_id"])])
class Payment(
    @Id
    val id: UUID,

    @Column(name = "order_id", nullable = false)
    val orderId: UUID,

    @Column(name = "member_id", nullable = false)
    val memberId: UUID,

    @Column(nullable = false)
    val amount: BigDecimal,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: PaymentStatus,

    @Column(name = "payment_key")
    val paymentKey: String? = null,

    @Column
    val method: String? = null,

    @Column(name = "approved_at")
    val approvedAt: Instant? = null,

    @Column(name = "failure_code")
    val failureCode: String? = null,

    @Column(name = "failure_message")
    val failureMessage: String? = null,

    @Column(name = "cancelled_at")
    var cancelledAt: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
) {
    fun markCancelled(now: Instant) {
        status = PaymentStatus.CANCELLED
        cancelledAt = now
    }
}
