package com.livecommerce.integration

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.UUID

class DeliveryFlowTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `a completed order is prepared, shipped and delivered through courier webhooks`() {
        val orderId = saga.completedOrder()

        val delivered = saga.waitUntil(DELIVERY_TIMEOUT) { saga.deliveryStatus(orderId) == "DELIVERED" }
        assertThat(delivered).isTrue()

        val delivery = saga.fetchDelivery(orderId)!!
        assertThat(delivery.get("trackingNumber").asText()).hasSize(12)
        assertThat(delivery.get("recipientName").asText()).isEqualTo("김테스트")
        val statuses = delivery.get("events").map { it.get("status").asText() }
        assertThat(statuses.first()).isEqualTo("PREPARING")
        assertThat(statuses.last()).isEqualTo("DELIVERED")
        assertThat(statuses).containsSubsequence("PREPARING", "SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED")
    }

    @Test
    fun `courier webhooks must be signed and fresh, are applied once, and never move a delivery backwards`() {
        val orderId = saga.completedOrder()
        assertThat(saga.waitUntil(Duration.ofSeconds(30)) { saga.fetchDelivery(orderId) != null }).isTrue()
        val trackingNumber = saga.fetchDelivery(orderId)!!.get("trackingNumber").asText()
        val staleEvent = """
            {"eventId":"late-${UUID.randomUUID()}","trackingNumber":"$trackingNumber","status":"IN_TRANSIT","location":"지연 허브","description":"늦게 도착한 간선 하차","occurredAt":"${Instant.now().minusSeconds(600)}"}
        """.trimIndent()
        val now = Instant.now().epochSecond

        assertThat(saga.postCourierWebhook(staleEvent, now, "sha256=deadbeef").statusCode()).isEqualTo(401)
        val expired = now - 3600
        assertThat(saga.postCourierWebhook(staleEvent, expired, saga.signCourierWebhook(expired, staleEvent)).statusCode()).isEqualTo(401)

        assertThat(saga.waitUntil(DELIVERY_TIMEOUT) { saga.deliveryStatus(orderId) == "DELIVERED" }).isTrue()

        val first = saga.postCourierWebhook(staleEvent, Instant.now().epochSecond, saga.signCourierWebhook(Instant.now().epochSecond, staleEvent))
        assertThat(first.statusCode()).isEqualTo(200)
        assertThat(saga.readJson(first).get("result").asText()).isEqualTo("RECORDED_OUT_OF_ORDER")

        val retryTimestamp = Instant.now().epochSecond
        val duplicate = saga.postCourierWebhook(staleEvent, retryTimestamp, saga.signCourierWebhook(retryTimestamp, staleEvent))
        assertThat(saga.readJson(duplicate).get("result").asText()).isEqualTo("DUPLICATE")

        val delivery = saga.fetchDelivery(orderId)!!
        assertThat(delivery.get("status").asText()).isEqualTo("DELIVERED")
        assertThat(delivery.get("events").count { it.get("location").asText() == "지연 허브" }).isEqualTo(1)

        val unknown = staleEvent.replace(trackingNumber, "000000000000")
        val unknownTimestamp = Instant.now().epochSecond
        assertThat(saga.postCourierWebhook(unknown, unknownTimestamp, saga.signCourierWebhook(unknownTimestamp, unknown)).statusCode()).isEqualTo(404)
    }

    companion object {
        private val DELIVERY_TIMEOUT: Duration = Duration.ofSeconds(90)
    }
}
