package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.TERMINAL_STATUSES
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import java.time.Duration

@Tag("chaos")
class SagaChaosTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `no event is lost while kafka is down and the order completes after it returns`() {
        saga.docker("stop", "kafka")
        try {
            val orderId = saga.createOrder(quantity = 1)

            val deliveryFailed = saga.waitUntil(Duration.ofSeconds(30)) {
                saga.outboxAttempts(Database.PAYMENT, orderId, "PaymentReserved") > 0
            }
            assertThat(deliveryFailed).isTrue()
            assertThat(saga.outboxStatus(Database.PAYMENT, orderId, "PaymentReserved")).isEqualTo("PENDING")
            assertThat(saga.orderStatus(orderId)).isEqualTo("AWAITING_PAYMENT")

            saga.docker("start", "kafka")

            assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(120))).isEqualTo("COMPLETED")
            assertThat(saga.awaitOutboxPublished(Database.PAYMENT, orderId, "PaymentReserved")).isTrue()
            assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 1)
        } finally {
            saga.docker("start", "kafka")
        }
    }

    @Test
    fun `order recovers when the payment database is briefly unavailable`() {
        saga.docker("stop", "postgres-payment")
        try {
            val orderId = saga.createOrder(quantity = 1)
            assertThat(saga.orderStatus(orderId)).isEqualTo("AWAITING_PAYMENT")

            Thread.sleep(OUTAGE_MS)
            saga.docker("start", "postgres-payment")
            saga.awaitDatabase(Database.PAYMENT)

            assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(120))).isEqualTo("COMPLETED")
        } finally {
            saga.docker("start", "postgres-payment")
            saga.awaitDatabase(Database.PAYMENT)
        }
    }

    @Test
    fun `order is compensated when the inventory step times out`() {
        saga.docker("stop", "postgres-inventory")
        try {
            val orderId = saga.createOrder(quantity = 1)

            assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(180))).isEqualTo("CANCELLED")
            assertThat(saga.fetchOrder(orderId).get("failureReason").asText()).isEqualTo("inventory step timed out")
            assertThat(saga.awaitOutboxPublished(Database.PAYMENT, orderId, "PaymentCancelled")).isTrue()
        } finally {
            saga.docker("start", "postgres-inventory")
            saga.awaitDatabase(Database.INVENTORY)
        }
    }

    companion object {
        private const val OUTAGE_MS = 5000L
    }
}
