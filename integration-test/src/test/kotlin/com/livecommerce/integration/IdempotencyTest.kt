package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_PRODUCT_ID
import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.INVENTORY_SERVICE_URL
import com.livecommerce.integration.SagaTestClient.Companion.PAYMENT_SERVICE_URL
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.util.UUID

class IdempotencyTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `repeated payment reservations for one order create exactly one payment and one event`() {
        val orderId = UUID.randomUUID()
        val body = """{"orderId":"$orderId","memberId":"${UUID.randomUUID()}","amount":39000}"""

        repeat(3) {
            assertThat(saga.post("$PAYMENT_SERVICE_URL/api/payments/reserve", body)).isEqualTo(202)
        }

        assertThat(
            saga.queryInt(Database.PAYMENT, "select count(*) from payments where order_id = ?", orderId)
        ).isEqualTo(1)
        assertThat(
            saga.queryInt(
                Database.PAYMENT,
                "select count(*) from outbox_events where aggregate_id = ? and event_type = 'PaymentReserved'",
                orderId
            )
        ).isEqualTo(1)
    }

    @Test
    fun `repeated inventory reservations and releases change stock exactly once`() {
        val orderId = UUID.randomUUID()
        val reserveBody = """{"orderId":"$orderId","productId":"$DEMO_PRODUCT_ID","quantity":2}"""
        val releaseBody = """{"orderId":"$orderId"}"""

        repeat(3) {
            assertThat(saga.post("$INVENTORY_SERVICE_URL/api/inventory/reserve", reserveBody)).isEqualTo(202)
        }
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 2)

        repeat(3) {
            assertThat(saga.post("$INVENTORY_SERVICE_URL/api/inventory/release", releaseBody)).isEqualTo(202)
        }
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK)
    }
}
