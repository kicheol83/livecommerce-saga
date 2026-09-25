package com.livecommerce.order.domain

import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant
import java.util.UUID

interface OrderRepository : JpaRepository<Order, UUID> {
    fun findTop50ByStatusInAndUpdatedAtBeforeOrderByUpdatedAtAsc(
        statuses: Collection<OrderStatus>,
        threshold: Instant
    ): List<Order>

    fun findTop50ByStatusAndPaymentDeadlineBeforeOrderByPaymentDeadlineAsc(
        status: OrderStatus,
        now: Instant
    ): List<Order>
}
