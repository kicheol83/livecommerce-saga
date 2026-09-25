package com.livecommerce.inventory.domain

import jakarta.persistence.LockModeType
import jakarta.persistence.QueryHint
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.jpa.repository.QueryHints
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface InventoryReservationRepository : JpaRepository<InventoryReservation, UUID> {
    fun findByOrderId(orderId: UUID): InventoryReservation?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from InventoryReservation r where r.orderId = :orderId")
    fun findByOrderIdForUpdate(@Param("orderId") orderId: UUID): InventoryReservation?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("select r from InventoryReservation r where r.status = :status and r.expiresAt < :now order by r.expiresAt asc")
    fun findExpiredForUpdate(
        @Param("status") status: ReservationStatus,
        @Param("now") now: Instant,
        pageable: Pageable
    ): List<InventoryReservation>
}
