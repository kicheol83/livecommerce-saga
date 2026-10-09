package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_PRODUCT_ID
import com.livecommerce.integration.SagaTestClient.Companion.DEMO_STOCK
import com.livecommerce.integration.SagaTestClient.Companion.SHIPPING_ADDRESS_JSON
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class OpenOrderLimitTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `a buyer cannot hold more stock with a second unpaid order for the same product`() {
        val buyer = saga.signupToken()
        val first = saga.gateway("POST", "/api/orders", buyer, orderBody(quantity = 2))
        assertThat(first.statusCode()).isEqualTo(201)
        val firstId = saga.readJson(first).get("orderId").asText()
        assertThat(awaitStatus(buyer, firstId, setOf("AWAITING_PAYMENT"))).isEqualTo("AWAITING_PAYMENT")

        val second = saga.gateway("POST", "/api/orders", buyer, orderBody(quantity = 2))

        assertThat(second.statusCode()).isEqualTo(409)
        val error = saga.readJson(second)
        assertThat(error.get("code").asText()).isEqualTo("OPEN_ORDER_EXISTS")
        assertThat(error.get("fields").get("orderId").asText()).isEqualTo(firstId)
        Thread.sleep(SETTLE_MILLIS)
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 2)

        assertThat(saga.gateway("POST", "/api/orders/$firstId/cancel", buyer).statusCode()).isEqualTo(200)
        assertThat(saga.awaitStock(DEMO_STOCK)).isTrue()

        val again = saga.gateway("POST", "/api/orders", buyer, orderBody(quantity = 1))
        assertThat(again.statusCode()).isEqualTo(201)
        saga.gateway("POST", "/api/orders/${saga.readJson(again).get("orderId").asText()}/cancel", buyer)
    }

    @Test
    fun `concurrent orders from one buyer produce exactly one open order`() {
        val buyer = saga.signupToken()
        val pool = Executors.newFixedThreadPool(PARALLEL_REQUESTS)
        val start = CountDownLatch(1)
        val responses = (1..PARALLEL_REQUESTS).map {
            pool.submit<Pair<Int, String>> {
                start.await()
                val response = saga.gateway("POST", "/api/orders", buyer, orderBody(quantity = 1))
                response.statusCode() to response.body()
            }
        }
        start.countDown()
        val results = responses.map { it.get(30, TimeUnit.SECONDS) }
        pool.shutdown()

        val created = results.filter { it.first == 201 }
        val rejected = results.filter { it.first == 409 }
        assertThat(created).hasSize(1)
        assertThat(rejected).hasSize(PARALLEL_REQUESTS - 1)
        assertThat(rejected.map { it.second }).allMatch { it.contains("OPEN_ORDER_EXISTS") }

        val orderId = saga.readJson(saga.gateway("GET", "/api/orders", buyer)).get("items").single().get("orderId").asText()
        assertThat(awaitStatus(buyer, orderId, setOf("AWAITING_PAYMENT"))).isEqualTo("AWAITING_PAYMENT")
        assertThat(saga.stock()).isEqualTo(DEMO_STOCK - 1)

        saga.gateway("POST", "/api/orders/$orderId/cancel", buyer)
        assertThat(saga.awaitStock(DEMO_STOCK)).isTrue()
    }

    private fun orderBody(quantity: Int): String {
        return """{"productId":"$DEMO_PRODUCT_ID","quantity":$quantity,"shippingAddress":$SHIPPING_ADDRESS_JSON}"""
    }

    private fun awaitStatus(token: String, orderId: String, expected: Set<String>): String {
        var status = ""
        saga.waitUntil(Duration.ofSeconds(20)) {
            status = saga.readJson(saga.gateway("GET", "/api/orders/$orderId", token)).get("status").asText()
            status in expected
        }
        return status
    }

    companion object {
        private const val PARALLEL_REQUESTS = 10
        private const val SETTLE_MILLIS = 2_000L
    }
}
