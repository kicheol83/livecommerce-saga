package com.livecommerce.order.api

import com.livecommerce.common.identity.IdentityHeaders
import com.livecommerce.order.api.dto.CreateOrderRequest
import com.livecommerce.order.api.dto.OrderErrorResponse
import com.livecommerce.order.api.dto.OrderResponse
import com.livecommerce.order.api.dto.SubmitPaymentRequest
import com.livecommerce.order.domain.OrderRepository
import com.livecommerce.order.saga.BuyerCancellation
import com.livecommerce.order.saga.OrderSagaOrchestrator
import com.livecommerce.order.saga.PaymentSubmission
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
    ): ResponseEntity<Any> {
        if (request.quantity !in 1..MAX_QUANTITY) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_QUANTITY", "Quantity must be between 1 and $MAX_QUANTITY")
        }
        val order = orchestrator.createOrder(userId, request.productId, request.quantity)
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

    @PostMapping("/{orderId}/payment")
    fun submitPayment(
        @PathVariable orderId: UUID,
        @RequestHeader(IdentityHeaders.USER_ID) userId: UUID,
        @RequestBody request: SubmitPaymentRequest
    ): ResponseEntity<Any> {
        return when (val result = orchestrator.submitPayment(orderId, userId, request.paymentKey, request.amount)) {
            is PaymentSubmission.Accepted -> ResponseEntity.status(HttpStatus.ACCEPTED).body(OrderResponse.from(result.order))
            PaymentSubmission.NotFound -> ResponseEntity.notFound().build()
            PaymentSubmission.NotPayable -> error(HttpStatus.CONFLICT, "ORDER_NOT_PAYABLE", "Order is not waiting for payment")
            PaymentSubmission.AmountMismatch -> error(HttpStatus.BAD_REQUEST, "AMOUNT_MISMATCH", "Paid amount does not match the order amount")
            PaymentSubmission.WindowExpired -> error(HttpStatus.CONFLICT, "PAYMENT_WINDOW_EXPIRED", "Payment window has expired")
        }
    }

    @PostMapping("/{orderId}/cancel")
    fun cancelOrder(
        @PathVariable orderId: UUID,
        @RequestHeader(IdentityHeaders.USER_ID) userId: UUID
    ): ResponseEntity<Any> {
        return when (val result = orchestrator.cancelByBuyer(orderId, userId)) {
            is BuyerCancellation.Cancelled -> ResponseEntity.ok(OrderResponse.from(result.order))
            BuyerCancellation.NotFound -> ResponseEntity.notFound().build()
            BuyerCancellation.NotCancellable -> error(HttpStatus.CONFLICT, "ORDER_NOT_CANCELLABLE", "Order can no longer be cancelled")
        }
    }

    private fun error(status: HttpStatus, code: String, message: String): ResponseEntity<Any> {
        return ResponseEntity.status(status).body(OrderErrorResponse(code, message))
    }

    companion object {
        private const val MAX_QUANTITY = 10
    }
}
