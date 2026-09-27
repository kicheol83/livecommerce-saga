package com.livecommerce.order.domain

import com.livecommerce.common.shipping.ShippingAddress
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: OrderStatus,

    @Column
    var amount: BigDecimal? = null,

    @Column(name = "payment_key")
    var paymentKey: String? = null,

    @Column(name = "payment_deadline")
    var paymentDeadline: Instant? = null,

    @Column(name = "failure_reason")
    var failureReason: String? = null,

    @Column(name = "retry_count", nullable = false)
    var retryCount: Int = 0,

    @Column(name = "recipient_name")
    val recipientName: String? = null,

    @Column(name = "recipient_phone")
    val recipientPhone: String? = null,

    @Column(name = "zip_code")
    val zipCode: String? = null,

    @Column(name = "address_line1")
    val addressLine1: String? = null,

    @Column(name = "address_line2")
    val addressLine2: String? = null,

    @Version
    var version: Long = 0,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
) {
    fun markAwaitingPayment(amount: BigDecimal, deadline: Instant) {
        status = OrderStatus.AWAITING_PAYMENT
        this.amount = amount
        paymentDeadline = deadline
        step()
    }

    fun markPaymentConfirming(paymentKey: String) {
        status = OrderStatus.PAYMENT_CONFIRMING
        this.paymentKey = paymentKey
        step()
    }

    fun markConfirmingStock() {
        status = OrderStatus.CONFIRMING_STOCK
        step()
    }

    fun markCompleted() {
        status = OrderStatus.COMPLETED
        step()
    }

    fun markCompensating(reason: String) {
        status = OrderStatus.COMPENSATING
        failureReason = reason
        step()
    }

    fun markCancelled(reason: String) {
        status = OrderStatus.CANCELLED
        failureReason = reason
        step()
    }

    fun recordRetry() {
        retryCount += 1
        updatedAt = Instant.now()
    }

    fun shippingAddress(): ShippingAddress? {
        if (recipientName == null || recipientPhone == null || zipCode == null || addressLine1 == null) {
            return null
        }
        return ShippingAddress(recipientName, recipientPhone, zipCode, addressLine1, addressLine2)
    }

    fun isPaymentWindowOpen(now: Instant): Boolean {
        return paymentDeadline?.isAfter(now) == true
    }

    private fun step() {
        retryCount = 0
        updatedAt = Instant.now()
    }
}
