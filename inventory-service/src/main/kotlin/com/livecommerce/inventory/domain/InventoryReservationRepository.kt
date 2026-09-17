package com.livecommerce.inventory.domain

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface InventoryReservationRepository : JpaRepository<InventoryReservation, UUID> {
    fun findByOrderId(orderId: UUID): InventoryReservation?
}
