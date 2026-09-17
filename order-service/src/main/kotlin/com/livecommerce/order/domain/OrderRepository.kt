package com.livecommerce.order.domain

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface OrderRepository : JpaRepository<Order, UUID>
