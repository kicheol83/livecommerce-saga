package com.livecommerce.inventory.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "inventory_reservations", uniqueConstraints = [UniqueConstraint(columnNames = ["order_id"])])
class InventoryReservation(
    @Id
    val id: UUID,

    @Column(name = "order_id", nullable = false)
    val orderId: UUID,

    @Column(name = "product_id", nullable = false)
    val productId: UUID,

    @Column(nullable = false)
    val quantity: Int,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)
