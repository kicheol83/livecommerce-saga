package com.livecommerce.payment.api

import com.livecommerce.payment.api.dto.CancelPaymentRequest
import com.livecommerce.payment.api.dto.ConfirmPaymentRequest
import com.livecommerce.payment.api.dto.ConfirmPaymentResponse
import com.livecommerce.payment.gateway.PaymentGatewayUnavailableException
import com.livecommerce.payment.service.PaymentService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/payments")
class PaymentController(
    private val paymentService: PaymentService
) {

    @PostMapping("/confirm")
    fun confirm(@RequestBody request: ConfirmPaymentRequest): ConfirmPaymentResponse {
        val status = paymentService.confirm(request.orderId, request.memberId, request.paymentKey, request.amount)
        return ConfirmPaymentResponse(request.orderId, status.name)
    }

    @PostMapping("/cancel")
    fun cancel(@RequestBody request: CancelPaymentRequest): ResponseEntity<Void> {
        paymentService.cancel(request.orderId, request.reason)
        return ResponseEntity.status(HttpStatus.ACCEPTED).build()
    }

    @ExceptionHandler(PaymentGatewayUnavailableException::class)
    fun handleGatewayUnavailable(ex: PaymentGatewayUnavailableException): ResponseEntity<Map<String, String>> {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(mapOf("code" to "PAYMENT_GATEWAY_UNAVAILABLE", "message" to (ex.message ?: "payment gateway unavailable")))
    }
}
