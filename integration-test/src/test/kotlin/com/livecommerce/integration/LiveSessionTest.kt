package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_PRODUCT_ID
import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.LIVE_SERVICE_URL
import com.livecommerce.integration.SagaTestClient.Companion.TERMINAL_STATUSES
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.sql.Timestamp
import java.time.Duration
import java.time.Instant

class LiveSessionTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `live session exposes the product and its current stock`() {
        val session = saga.getJson("$LIVE_SERVICE_URL/api/live/session")

        assertThat(session.get("productId").asText()).isEqualTo(DEMO_PRODUCT_ID.toString())
        assertThat(session.get("stock").asInt()).isEqualTo(DEMO_STOCK)
        assertThat(Instant.parse(session.get("endsAt").asText())).isAfter(Instant.now())
    }

    @Test
    fun `reserving inventory publishes a stock changed event`() {
        val startedAt = Timestamp.from(Instant.now().minusSeconds(1))
        val orderId = saga.createOrder(quantity = 1)

        assertThat(saga.pollUntilStatus(orderId, TERMINAL_STATUSES, Duration.ofSeconds(20))).isEqualTo("COMPLETED")

        val published = saga.waitUntil(Duration.ofSeconds(15)) {
            saga.queryInt(
                Database.INVENTORY,
                "select count(*) from outbox_events where event_type = 'StockChanged' and status = 'PUBLISHED' and aggregate_id = ? and created_at >= ?",
                DEMO_PRODUCT_ID,
                startedAt
            ) > 0
        }
        assertThat(published).isTrue()
    }
}
