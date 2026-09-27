package com.livecommerce.delivery.domain

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface DeliveryRepository : JpaRepository<Delivery, UUID> {
    fun findByOrderId(orderId: UUID): Delivery?

    fun existsByOrderId(orderId: UUID): Boolean

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Delivery d where d.trackingNumber = :trackingNumber")
    fun findByTrackingNumberForUpdate(@Param("trackingNumber") trackingNumber: String): Delivery?
}

interface TrackingEventRepository : JpaRepository<TrackingEvent, UUID> {
    fun existsByEventId(eventId: String): Boolean

    fun findAllByDeliveryIdOrderByOccurredAtAsc(deliveryId: UUID): List<TrackingEvent>
}
