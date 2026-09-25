package com.livecommerce.payment.gateway

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Component
class PaymentGatewayRouter(
    private val tossPaymentGateway: TossPaymentGateway,
    @Value("\${payments.fake-enabled:false}") private val fakeEnabled: Boolean
) : PaymentGateway {

    override fun confirm(paymentKey: String, orderId: UUID, amount: BigDecimal): GatewayResult {
        return if (isFake(paymentKey)) fakeConfirm(paymentKey) else tossPaymentGateway.confirm(paymentKey, orderId, amount)
    }

    override fun cancel(paymentKey: String, orderId: UUID, reason: String) {
        if (!isFake(paymentKey)) {
            tossPaymentGateway.cancel(paymentKey, orderId, reason)
        }
    }

    private fun isFake(paymentKey: String): Boolean {
        return fakeEnabled && paymentKey.startsWith(FAKE_PREFIX)
    }

    private fun fakeConfirm(paymentKey: String): GatewayResult {
        return if (paymentKey.startsWith(FAKE_DECLINE_PREFIX)) {
            GatewayResult.Declined("REJECT_CARD_COMPANY", "Fake gateway declined the card")
        } else {
            GatewayResult.Approved("FAKE", Instant.now())
        }
    }

    companion object {
        private const val FAKE_PREFIX = "fake_"
        private const val FAKE_DECLINE_PREFIX = "fake_decline"
    }
}
