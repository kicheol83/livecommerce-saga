package com.livecommerce.delivery.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "deliveries")
class Delivery(
    @Id
    val id: UUID,

    @Column(name = "order_id", nullable = false, unique = true)
    val orderId: UUID,

    @Column(name = "member_id", nullable = false)
    val memberId: UUID,

    @Column(name = "product_id", nullable = false)
    val productId: UUID,

    @Column(nullable = false)
    val quantity: Int,

    @Column(name = "recipient_name", nullable = false)
    val recipientName: String,

    @Column(name = "recipient_phone", nullable = false)
    val recipientPhone: String,

    @Column(name = "zip_code", nullable = false)
    val zipCode: String,

    @Column(name = "address_line1", nullable = false)
    val addressLine1: String,

    @Column(name = "address_line2")
    val addressLine2: String?,

    @Column(nullable = false)
    val carrier: String,

    @Column(name = "tracking_number", nullable = false, unique = true)
    val trackingNumber: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: DeliveryStatus,

    @Column(name = "ordered_at", nullable = false)
    val orderedAt: Instant,

    @Column(name = "delivered_at")
    var deliveredAt: Instant? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
) {
    fun advanceTo(next: DeliveryStatus, occurredAt: Instant) {
        status = next
        updatedAt = Instant.now()
        if (next == DeliveryStatus.DELIVERED) {
            deliveredAt = occurredAt
        }
    }
}
