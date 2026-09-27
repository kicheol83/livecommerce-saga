package com.livecommerce.integration

import com.livecommerce.integration.SagaTestClient.Companion.DEMO_PRODUCT_ID
import com.livecommerce.integration.SagaTestClient.Companion.SHIPPING_ADDRESS_JSON
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class MyOrdersAndProfileTest {

    private val saga = SagaTestClient()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `buyers see only their own orders`() {
        val owner = saga.signupToken()
        val stranger = saga.signupToken()
        val body = """{"productId":"$DEMO_PRODUCT_ID","quantity":1,"shippingAddress":$SHIPPING_ADDRESS_JSON}"""
        val created = saga.gateway("POST", "/api/orders", owner, body)
        assertThat(created.statusCode()).isEqualTo(201)
        val orderId = saga.readJson(created).get("orderId").asText()

        val mine = saga.readJson(saga.gateway("GET", "/api/orders", owner)).get("items").map { it.get("orderId").asText() }
        val theirs = saga.readJson(saga.gateway("GET", "/api/orders", stranger)).get("items").map { it.get("orderId").asText() }
        assertThat(mine).containsExactly(orderId)
        assertThat(theirs).doesNotContain(orderId)

        saga.gateway("POST", "/api/orders/$orderId/cancel", owner)
    }

    @Test
    fun `the profile keeps a validated default shipping address`() {
        val token = saga.signupToken()

        val saved = saga.gateway("PUT", "/api/auth/me/shipping-address", token, SHIPPING_ADDRESS_JSON)
        assertThat(saved.statusCode()).isEqualTo(200)
        val me = saga.readJson(saga.gateway("GET", "/api/auth/me", token))
        assertThat(me.get("shippingAddress").get("zipCode").asText()).isEqualTo("04799")
        assertThat(me.get("shippingAddress").get("recipientName").asText()).isEqualTo("김테스트")

        val invalid = saga.gateway("PUT", "/api/auth/me/shipping-address", token, SHIPPING_ADDRESS_JSON.replace("010-1234-5678", "12"))
        assertThat(invalid.statusCode()).isEqualTo(400)
        assertThat(saga.readJson(invalid).get("fields").has("phone")).isTrue()
    }

    @Test
    fun `orders are rejected without a valid shipping address`() {
        val token = saga.signupToken()

        val missing = saga.gateway("POST", "/api/orders", token, """{"productId":"$DEMO_PRODUCT_ID","quantity":1}""")
        assertThat(missing.statusCode()).isEqualTo(400)
        assertThat(saga.readJson(missing).get("code").asText()).isEqualTo("SHIPPING_ADDRESS_REQUIRED")

        val badZip = """{"productId":"$DEMO_PRODUCT_ID","quantity":1,"shippingAddress":${SHIPPING_ADDRESS_JSON.replace("04799", "12")}}"""
        val invalid = saga.gateway("POST", "/api/orders", token, badZip)
        assertThat(invalid.statusCode()).isEqualTo(400)
        assertThat(saga.readJson(invalid).get("code").asText()).isEqualTo("INVALID_SHIPPING_ADDRESS")
    }
}
