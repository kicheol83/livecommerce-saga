package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_PRODUCT_ID
import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.LIVE_SERVICE_URL
import com.livecommerce.integration.SagaTestClient.Companion.ORDER_SERVICE_URL
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Duration

class AdminApiTest {

    private val saga = SagaTestClient()
    private lateinit var admin: String

    @BeforeEach
    fun setUp() {
        saga.resetStock()
        admin = saga.adminToken()
    }

    @Test
    fun `admin apis are closed to regular users and to calls that bypass the gateway`() {
        val user = saga.signupToken()

        assertThat(saga.gateway("GET", "/api/admin/orders/summary", null).statusCode()).isEqualTo(401)
        assertThat(saga.gateway("GET", "/api/admin/orders/summary", user).statusCode()).isEqualTo(403)
        assertThat(saga.statusOf("$ORDER_SERVICE_URL/api/admin/orders/summary")).isEqualTo(403)
        assertThat(saga.gateway("GET", "/api/admin/orders/summary", admin).statusCode()).isEqualTo(200)
    }

    @Test
    fun `saga inspector shows one order across order, payment and inventory`() {
        val orderId = saga.completedOrder()

        val order = saga.readJson(saga.gateway("GET", "/api/admin/orders/$orderId", admin))
        assertThat(order.get("status").asText()).isEqualTo("COMPLETED")

        val payment = saga.readJson(saga.gateway("GET", "/api/admin/payments/orders/$orderId", admin))
        assertThat(payment.get("status").asText()).isEqualTo("CONFIRMED")
        assertThat(payment.get("method").asText()).isEqualTo("FAKE")

        val reservation = saga.readJson(saga.gateway("GET", "/api/admin/inventory/reservations/$orderId", admin))
        assertThat(reservation.get("status").asText()).isEqualTo("CONFIRMED")

        assertThat(saga.awaitOutboxPublished(Database.PAYMENT, orderId, "PaymentConfirmed")).isTrue()
        assertThat(saga.awaitOutboxPublished(Database.INVENTORY, orderId, "InventoryConfirmed")).isTrue()
        val paymentEvents = saga.readJson(saga.gateway("GET", "/api/admin/payments/outbox?aggregateId=$orderId", admin))
        assertThat(paymentEvents.map { it.get("eventType").asText() }).contains("PaymentConfirmed")
        val inventoryEvents = saga.readJson(saga.gateway("GET", "/api/admin/inventory/outbox?aggregateId=$orderId", admin))
        assertThat(inventoryEvents.map { it.get("eventType").asText() }).contains("InventoryReserved", "InventoryConfirmed")
    }

    @Test
    fun `summary reflects a completed order and its revenue`() {
        val before = saga.readJson(saga.gateway("GET", "/api/admin/orders/summary", admin))
        val completedBefore = before.get("countsByStatus").get("COMPLETED")?.asLong() ?: 0L
        val revenueBefore = before.get("completedRevenue").decimalValue()

        saga.completedOrder()

        val after = saga.readJson(saga.gateway("GET", "/api/admin/orders/summary", admin))
        assertThat(after.get("countsByStatus").get("COMPLETED").asLong()).isEqualTo(completedBefore + 1)
        assertThat(after.get("completedRevenue").decimalValue().subtract(revenueBefore)).isEqualByComparingTo(BigDecimal("39000"))
        assertThat(after.get("ordersPerMinute").size()).isGreaterThan(0)

        val payments = saga.gateway("GET", "/api/admin/payments/summary", admin)
        assertThat(payments.statusCode()).isEqualTo(200)
        assertThat(saga.readJson(payments).has("confirmedAmount")).isTrue()
        assertThat(saga.readJson(saga.gateway("GET", "/api/admin/payments/outbox/health", admin)).has("pending")).isTrue()
        assertThat(saga.readJson(saga.gateway("GET", "/api/admin/inventory/outbox/health", admin)).has("pending")).isTrue()
    }

    @Test
    fun `admin stock and price changes reach the live session`() {
        val path = "/api/admin/inventory/products/$DEMO_PRODUCT_ID"
        try {
            val updated = saga.gateway("PUT", path, admin, """{"quantityAvailable":50,"unitPrice":41000}""")
            assertThat(updated.statusCode()).isEqualTo(200)
            assertThat(saga.readJson(updated).get("quantityAvailable").asInt()).isEqualTo(50)

            val session = saga.getJson("$LIVE_SERVICE_URL/api/live/session")
            assertThat(session.get("stock").asInt()).isEqualTo(50)
            assertThat(session.get("price").asInt()).isEqualTo(41000)

            val invalid = saga.gateway("PUT", path, admin, """{"quantityAvailable":-1,"unitPrice":41000}""")
            assertThat(invalid.statusCode()).isEqualTo(400)
        } finally {
            saga.gateway("PUT", path, admin, """{"quantityAvailable":$DEMO_STOCK,"unitPrice":39000}""")
        }
    }

    @Test
    fun `admin can cancel an unpaid order but has nothing to retry on it`() {
        val orderId = saga.createOrder(quantity = 1)
        assertThat(saga.awaitPayable(orderId)).isEqualTo("AWAITING_PAYMENT")

        assertThat(saga.gateway("POST", "/api/admin/orders/$orderId/retry", admin).statusCode()).isEqualTo(409)

        assertThat(saga.gateway("POST", "/api/admin/orders/$orderId/cancel", admin).statusCode()).isEqualTo(202)
        assertThat(saga.pollUntilStatus(orderId, setOf("CANCELLED"), Duration.ofSeconds(10))).isEqualTo("CANCELLED")
        assertThat(saga.fetchOrder(orderId).get("failureReason").asText()).isEqualTo("cancelled by admin")
        assertThat(saga.awaitStock(DEMO_STOCK)).isTrue()

        assertThat(saga.gateway("POST", "/api/admin/orders/$orderId/cancel", admin).statusCode()).isEqualTo(409)
    }
}
