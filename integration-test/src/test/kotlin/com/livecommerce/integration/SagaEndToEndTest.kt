package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.TERMINAL_STATUSES
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.time.Duration

class SagaEndToEndTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `order completes when payment and inventory both succeed`() {
        val orderId = saga.createOrder(quantity = 1)

        val finalStatus = saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(20))

        assertThat(finalStatus).isEqualTo("COMPLETED")
        assertThat(saga.awaitOutboxPublished(Database.PAYMENT, orderId, "PaymentReserved")).isTrue()
        assertThat(saga.awaitOutboxPublished(Database.INVENTORY, orderId, "InventoryReserved")).isTrue()
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 1)
    }

    @Test
    fun `order is cancelled and payment is compensated when stock is insufficient`() {
        val orderId = saga.createOrder(quantity = DEMO_STOCK + 1)

        val finalStatus = saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(20))

        assertThat(finalStatus).isEqualTo("CANCELLED")
        assertThat(saga.fetchOrder(orderId).get("failureReason").asText()).isEqualTo("insufficient stock")
        assertThat(saga.awaitOutboxPublished(Database.INVENTORY, orderId, "InventoryFailed")).isTrue()
        assertThat(saga.awaitOutboxPublished(Database.PAYMENT, orderId, "PaymentCancelled")).isTrue()
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK)
    }
}
