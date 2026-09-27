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
@Table(name = "tracking_events")
class TrackingEvent(
    @Id
    val id: UUID,

    @Column(name = "delivery_id", nullable = false)
    val deliveryId: UUID,

    @Column(name = "event_id", nullable = false, unique = true)
    val eventId: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val status: DeliveryStatus,

    @Column(nullable = false)
    val location: String,

    @Column(nullable = false)
    val description: String,

    @Column(name = "occurred_at", nullable = false)
    val occurredAt: Instant,

    @Column(name = "received_at", nullable = false)
    val receivedAt: Instant = Instant.now()
)
