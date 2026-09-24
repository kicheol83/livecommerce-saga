package com.livecommerce.order.api

import com.livecommerce.common.identity.IdentityHeaders
import com.livecommerce.order.api.dto.CreateOrderRequest
import com.livecommerce.order.api.dto.OrderResponse
import com.livecommerce.order.domain.OrderRepository
import com.livecommerce.order.saga.OrderSagaOrchestrator
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/orders")
class OrderController(
    private val orchestrator: OrderSagaOrchestrator,
    private val orderRepository: OrderRepository
) {

    @PostMapping
    fun createOrder(
        @RequestHeader(IdentityHeaders.USER_ID) userId: UUID,
        @RequestBody request: CreateOrderRequest
    ): ResponseEntity<OrderResponse> {
        val order = orchestrator.createOrder(userId, request.productId, request.quantity, request.amount)
        return ResponseEntity.status(HttpStatus.CREATED).body(OrderResponse.from(order))
    }

    @GetMapping("/{orderId}")
    fun getOrder(
        @PathVariable orderId: UUID,
        @RequestHeader(IdentityHeaders.USER_ID) userId: UUID,
        @RequestHeader(IdentityHeaders.USER_ROLES, required = false) roles: String?
    ): ResponseEntity<OrderResponse> {
        val order = orderRepository.findById(orderId).orElse(null) ?: return ResponseEntity.notFound().build()
        val isAdmin = roles?.split(",")?.contains(IdentityHeaders.ADMIN_ROLE) == true
        if (order.memberId != userId && !isAdmin) {
            return ResponseEntity.notFound().build()
        }
        return ResponseEntity.ok(OrderResponse.from(order))
    }
}
