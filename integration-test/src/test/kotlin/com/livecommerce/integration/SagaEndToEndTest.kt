package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.TERMINAL_STATUSES
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Duration

class SagaEndToEndTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `order completes after stock is held and the payment is confirmed`() {
        val orderId = saga.createOrder(quantity = 1)

        assertThat(saga.awaitPayable(orderId)).isEqualTo("AWAITING_PAYMENT")
        assertThat(saga.fetchOrder(orderId).get("amount").decimalValue()).isEqualByComparingTo(BigDecimal("39000"))
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 1)

        assertThat(saga.submitPayment(orderId, saga.approvalKey())).isEqualTo(202)

        assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(20))).isEqualTo("COMPLETED")
        assertThat(saga.awaitOutboxPublished(Database.INVENTORY, orderId, "InventoryReserved")).isTrue()
        assertThat(saga.awaitOutboxPublished(Database.PAYMENT, orderId, "PaymentConfirmed")).isTrue()
        assertThat(saga.awaitOutboxPublished(Database.INVENTORY, orderId, "InventoryConfirmed")).isTrue()
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 1)
    }

    @Test
    fun `order is cancelled without any charge when stock is insufficient`() {
        saga.resetStock(LOW_STOCK)
        val orderId = saga.createOrder(quantity = LOW_STOCK + 1)

        assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(20))).isEqualTo("CANCELLED")
        assertThat(saga.fetchOrder(orderId).get("failureReason").asText()).isEqualTo("insufficient stock")
        assertThat(saga.awaitOutboxPublished(Database.INVENTORY, orderId, "InventoryFailed")).isTrue()
        assertThat(saga.paymentCount(orderId)).isZero()
        assertThat(saga.stock()).isEqualTo(LOW_STOCK)
    }

    @Test
    fun `declined payment cancels the order and returns the held stock`() {
        val orderId = saga.createOrder(quantity = 2)
        assertThat(saga.awaitPayable(orderId)).isEqualTo("AWAITING_PAYMENT")
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 2)

        assertThat(saga.submitPayment(orderId, saga.declineKey())).isEqualTo(202)

        assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(20))).isEqualTo("CANCELLED")
        assertThat(saga.fetchOrder(orderId).get("failureReason").asText()).isEqualTo("payment declined")
        assertThat(saga.awaitOutboxPublished(Database.PAYMENT, orderId, "PaymentFailed")).isTrue()
        assertThat(saga.awaitStock(DEMO_STOCK)).isTrue()
    }

    @Test
    fun `tampered payment amount is rejected and the buyer can still cancel`() {
        val orderId = saga.createOrder(quantity = 1)
        assertThat(saga.awaitPayable(orderId)).isEqualTo("AWAITING_PAYMENT")

        assertThat(saga.submitPayment(orderId, saga.approvalKey(), amount = "1")).isEqualTo(400)
        assertThat(saga.orderStatus(orderId)).isEqualTo("AWAITING_PAYMENT")
        assertThat(saga.paymentCount(orderId)).isZero()

        assertThat(saga.cancelOrder(orderId)).isEqualTo(200)
        assertThat(saga.orderStatus(orderId)).isEqualTo("CANCELLED")
        assertThat(saga.fetchOrder(orderId).get("failureReason").asText()).isEqualTo("cancelled by buyer")
        assertThat(saga.awaitStock(DEMO_STOCK)).isTrue()
    }

    companion object {
        private const val LOW_STOCK = 3
    }
}
