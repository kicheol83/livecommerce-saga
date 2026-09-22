package com.livecommerce.integration

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.sql.DriverManager
import java.time.Duration
import java.util.UUID

class SagaEndToEndTest {

    private val httpClient = HttpClient.newHttpClient()
    private val objectMapper = ObjectMapper()
    private val productId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    private val orderServiceUrl = "http://localhost:8081"

    @Test
    fun `order completes when payment and inventory both succeed`() {
        val orderId = createOrder(quantity = 1, amount = "39000")

        val finalStatus = pollUntilTerminal(orderId)

        assertThat(finalStatus).isEqualTo("COMPLETED")
        assertThat(
            outboxEventPublished(5456, "payment_db", "payment_user", "payment_pass", orderId, "PaymentReserved")
        ).isTrue()
        assertThat(
            outboxEventPublished(5457, "inventory_db", "inventory_user", "inventory_pass", orderId, "InventoryReserved")
        ).isTrue()
    }

    @Test
    fun `order is cancelled and payment is compensated when stock is insufficient`() {
        val orderId = createOrder(quantity = 999, amount = "39000")

        val finalStatus = pollUntilTerminal(orderId)

        assertThat(finalStatus).isEqualTo("CANCELLED")
        assertThat(
            outboxEventPublished(5457, "inventory_db", "inventory_user", "inventory_pass", orderId, "InventoryFailed")
        ).isTrue()
        assertThat(
            outboxEventPublished(5456, "payment_db", "payment_user", "payment_pass", orderId, "PaymentCancelled")
        ).isTrue()
        assertThat(fetchOrder(orderId).get("failureReason").asText()).isEqualTo("insufficient stock")
    }

    private fun createOrder(quantity: Int, amount: String): String {
        val memberId = UUID.randomUUID()
        val body = """
            {"memberId":"$memberId","productId":"$productId","quantity":$quantity,"amount":$amount}
        """.trimIndent()
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$orderServiceUrl/api/orders"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        assertThat(response.statusCode()).isEqualTo(201)
        return objectMapper.readTree(response.body()).get("orderId").asText()
    }

    private fun fetchOrder(orderId: String): JsonNode {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$orderServiceUrl/api/orders/$orderId"))
            .GET()
            .build()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        return objectMapper.readTree(response.body())
    }

    private fun pollUntilTerminal(orderId: String): String {
        val deadline = System.currentTimeMillis() + Duration.ofSeconds(15).toMillis()
        var lastStatus = "UNKNOWN"
        while (System.currentTimeMillis() < deadline) {
            lastStatus = fetchOrder(orderId).get("status").asText()
            if (lastStatus == "COMPLETED" || lastStatus == "CANCELLED") {
                return lastStatus
            }
            Thread.sleep(300)
        }
        return lastStatus
    }

    private fun outboxEventPublished(
        port: Int,
        database: String,
        username: String,
        password: String,
        aggregateId: String,
        eventType: String
    ): Boolean {
        DriverManager.getConnection("jdbc:postgresql://localhost:$port/$database", username, password).use { connection ->
            connection.prepareStatement(
                "select status from outbox_events where aggregate_id = ? and event_type = ?"
            ).use { statement ->
                statement.setObject(1, UUID.fromString(aggregateId))
                statement.setString(2, eventType)
                statement.executeQuery().use { resultSet ->
                    return resultSet.next() && resultSet.getString("status") == "PUBLISHED"
                }
            }
        }
    }
}
