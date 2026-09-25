package com.livecommerce.order.client

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.math.BigDecimal
import java.util.UUID

data class ConfirmPaymentRequest(
    val orderId: UUID,
    val memberId: UUID,
    val paymentKey: String,
    val amount: BigDecimal
)

data class CancelPaymentRequest(
    val orderId: UUID,
    val reason: String
)

@Component
class PaymentClient(
    @Value("\${services.payment.base-url}") baseUrl: String,
    restClientBuilder: RestClient.Builder
) {
    private val client = restClientBuilder
        .baseUrl(baseUrl)
        .requestFactory(timeoutRequestFactory())
        .build()

    fun confirmPayment(request: ConfirmPaymentRequest) {
        client.post()
            .uri("/api/payments/confirm")
            .body(request)
            .retrieve()
            .toBodilessEntity()
    }

    fun cancelPayment(request: CancelPaymentRequest) {
        client.post()
            .uri("/api/payments/cancel")
            .body(request)
            .retrieve()
            .toBodilessEntity()
    }
}
