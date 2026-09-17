package com.livecommerce.order.api

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
    fun createOrder(@RequestBody request: CreateOrderRequest): ResponseEntity<OrderResponse> {
        val order = orchestrator.createOrder(
            request.memberId,
            request.productId,
            request.quantity,
            request.amount
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(OrderResponse.from(order))
    }

    @GetMapping("/{orderId}")
    fun getOrder(@PathVariable orderId: UUID): ResponseEntity<OrderResponse> {
        val order = orderRepository.findById(orderId).orElseThrow()
        return ResponseEntity.ok(OrderResponse.from(order))
    }
}
