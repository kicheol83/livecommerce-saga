package com.livecommerce.order.client

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.math.BigDecimal
import java.util.UUID

data class ReservePaymentRequest(
    val orderId: UUID,
    val memberId: UUID,
    val amount: BigDecimal
)

data class CancelPaymentRequest(
    val orderId: UUID
)

@Component
class PaymentClient(
    @Value("\${services.payment.base-url}") baseUrl: String,
    restClientBuilder: RestClient.Builder
) {
    private val client = restClientBuilder.baseUrl(baseUrl).build()

    fun reservePayment(request: ReservePaymentRequest) {
        client.post()
            .uri("/api/payments/reserve")
            .header("Idempotency-Key", request.orderId.toString())
            .body(request)
            .retrieve()
            .toBodilessEntity()
    }

    fun cancelPayment(request: CancelPaymentRequest) {
        client.post()
            .uri("/api/payments/cancel")
            .header("Idempotency-Key", request.orderId.toString())
            .body(request)
            .retrieve()
            .toBodilessEntity()
    }
}
