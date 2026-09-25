package com.livecommerce.payment.gateway

import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

sealed interface GatewayResult {
    data class Approved(val method: String?, val approvedAt: Instant?) : GatewayResult
    data class Declined(val code: String, val message: String) : GatewayResult
}

interface PaymentGateway {
    fun confirm(paymentKey: String, orderId: UUID, amount: BigDecimal): GatewayResult
    fun cancel(paymentKey: String, orderId: UUID, reason: String)
}

class PaymentGatewayUnavailableException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
