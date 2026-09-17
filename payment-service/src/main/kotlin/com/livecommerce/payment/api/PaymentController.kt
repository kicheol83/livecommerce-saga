package com.livecommerce.payment.api

import com.livecommerce.payment.api.dto.CancelPaymentRequest
import com.livecommerce.payment.api.dto.ReservePaymentRequest
import com.livecommerce.payment.service.PaymentService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/payments")
class PaymentController(
    private val paymentService: PaymentService
) {

    @PostMapping("/reserve")
    fun reserve(@RequestBody request: ReservePaymentRequest): ResponseEntity<Void> {
        paymentService.reserve(request.orderId, request.memberId, request.amount)
        return ResponseEntity.status(HttpStatus.ACCEPTED).build()
    }

    @PostMapping("/cancel")
    fun cancel(@RequestBody request: CancelPaymentRequest): ResponseEntity<Void> {
        paymentService.cancel(request.orderId)
        return ResponseEntity.status(HttpStatus.ACCEPTED).build()
    }
}
