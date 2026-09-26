package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.PAYABLE_OR_TERMINAL
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
                saga.outboxAttempts(Database.INVENTORY, orderId, "InventoryReserved") > 0
            }
            assertThat(deliveryFailed).isTrue()
            assertThat(saga.outboxStatus(Database.INVENTORY, orderId, "InventoryReserved")).isEqualTo("PENDING")
            assertThat(saga.orderStatus(orderId)).isEqualTo("AWAITING_STOCK")

            saga.docker("start", "kafka")

            assertThat(saga.pollUntilStatus(orderId, PAYABLE_OR_TERMINAL, Duration.ofSeconds(120))).isEqualTo("AWAITING_PAYMENT")
            assertThat(saga.submitPayment(orderId, saga.approvalKey())).isEqualTo(202)
            assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(60))).isEqualTo("COMPLETED")
            assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 1)
        } finally {
            saga.docker("start", "kafka")
        }
    }

    @Test
    fun `payment confirmation recovers when the payment database is briefly unavailable`() {
        val orderId = saga.createOrder(quantity = 1)
        assertThat(saga.awaitPayable(orderId)).isEqualTo("AWAITING_PAYMENT")

        saga.docker("stop", "postgres-payment")
        try {
            assertThat(saga.submitPayment(orderId, saga.approvalKey())).isEqualTo(202)
            assertThat(saga.orderStatus(orderId)).isEqualTo("PAYMENT_CONFIRMING")

            Thread.sleep(OUTAGE_MS)
            saga.docker("start", "postgres-payment")
            saga.awaitDatabase(Database.PAYMENT)

            assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(120))).isEqualTo("COMPLETED")
            assertThat(saga.paymentCount(orderId)).isEqualTo(1)
        } finally {
            saga.docker("start", "postgres-payment")
            saga.awaitDatabase(Database.PAYMENT)
        }
    }

    @Test
    fun `order is cancelled without a charge when the stock hold times out`() {
        saga.docker("stop", "postgres-inventory")
        try {
            val orderId = saga.createOrder(quantity = 1)

            assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(180))).isEqualTo("CANCELLED")
            assertThat(saga.fetchOrder(orderId).get("failureReason").asText()).isEqualTo("inventory step timed out")
            assertThat(saga.paymentCount(orderId)).isZero()
        } finally {
            saga.docker("start", "postgres-inventory")
            saga.awaitDatabase(Database.INVENTORY)
        }
    }

    companion object {
        private const val OUTAGE_MS = 5000L
    }
}
