package com.livecommerce.inventory.domain

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface InventoryReservationRepository : JpaRepository<InventoryReservation, UUID> {
    fun findByOrderId(orderId: UUID): InventoryReservation?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from InventoryReservation r where r.orderId = :orderId")
    fun findByOrderIdForUpdate(@Param("orderId") orderId: UUID): InventoryReservation?
}
