package com.livecommerce.integration

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.inventory.InventoryServiceApplication
import com.livecommerce.order.OrderServiceApplication
import com.livecommerce.payment.PaymentServiceApplication
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.context.ConfigurableApplicationContext
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.utility.DockerImageName
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.sql.DriverManager
import java.time.Duration
import java.util.UUID

@Testcontainers
class SagaEndToEndTest {

    companion object {
        @Container
        @JvmStatic
        val orderDb = KPostgresContainer("postgres:16")

        @Container
        @JvmStatic
        val paymentDb = KPostgresContainer("postgres:16")

        @Container
        @JvmStatic
        val inventoryDb = KPostgresContainer("postgres:16")

        @Container
        @JvmStatic
        val kafka = KKafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.7.1")).withKraft()

        private lateinit var orderCtx: ConfigurableApplicationContext
        private lateinit var paymentCtx: ConfigurableApplicationContext
        private lateinit var inventoryCtx: ConfigurableApplicationContext
        private var orderPort: Int = 0

        @JvmStatic
        @BeforeAll
        fun startServices() {
            paymentCtx = SpringApplicationBuilder(PaymentServiceApplication::class.java)
                .run(
                    "--spring.config.name=none",
                    "--server.port=0",
                    "--spring.datasource.url=${paymentDb.jdbcUrl}",
                    "--spring.datasource.username=${paymentDb.username}",
                    "--spring.datasource.password=${paymentDb.password}",
                    "--spring.jpa.hibernate.ddl-auto=validate",
                    "--spring.jpa.open-in-view=false",
                    "--spring.flyway.enabled=true",
                    "--spring.flyway.locations=filesystem:${System.getProperty("payment.migrations.path")}",
                    "--spring.kafka.bootstrap-servers=${kafka.bootstrapServers}"
                )
            val paymentPort = paymentCtx.environment.getProperty("local.server.port")

            inventoryCtx = SpringApplicationBuilder(InventoryServiceApplication::class.java)
                .run(
                    "--spring.config.name=none",
                    "--server.port=0",
                    "--spring.datasource.url=${inventoryDb.jdbcUrl}",
                    "--spring.datasource.username=${inventoryDb.username}",
                    "--spring.datasource.password=${inventoryDb.password}",
                    "--spring.jpa.hibernate.ddl-auto=validate",
                    "--spring.jpa.open-in-view=false",
                    "--spring.flyway.enabled=true",
                    "--spring.flyway.locations=filesystem:${System.getProperty("inventory.migrations.path")}",
                    "--spring.kafka.bootstrap-servers=${kafka.bootstrapServers}"
                )
            val inventoryPort = inventoryCtx.environment.getProperty("local.server.port")

            orderCtx = SpringApplicationBuilder(OrderServiceApplication::class.java)
                .run(
                    "--spring.config.name=none",
                    "--server.port=0",
                    "--spring.datasource.url=${orderDb.jdbcUrl}",
                    "--spring.datasource.username=${orderDb.username}",
                    "--spring.datasource.password=${orderDb.password}",
                    "--spring.jpa.hibernate.ddl-auto=validate",
                    "--spring.jpa.open-in-view=false",
                    "--spring.flyway.enabled=true",
                    "--spring.flyway.locations=filesystem:${System.getProperty("order.migrations.path")}",
                    "--spring.kafka.bootstrap-servers=${kafka.bootstrapServers}",
                    "--services.payment.base-url=http://localhost:$paymentPort",
                    "--services.inventory.base-url=http://localhost:$inventoryPort"
                )
            orderPort = orderCtx.environment.getProperty("local.server.port")!!.toInt()
        }

        @JvmStatic
        @AfterAll
        fun stopServices() {
            orderCtx.close()
            inventoryCtx.close()
            paymentCtx.close()
        }
    }

    private val httpClient = HttpClient.newHttpClient()
    private val objectMapper = ObjectMapper()
    private val productId = UUID.fromString("11111111-1111-1111-1111-111111111111")

    @Test
    fun `order completes when payment and inventory both succeed`() {
        val orderId = createOrder(quantity = 1, amount = "39000")

        val finalStatus = pollUntilTerminal(orderId)

        assertThat(finalStatus).isEqualTo("COMPLETED")
        assertThat(outboxEventPublished(paymentDb, orderId, "PaymentReserved")).isTrue()
        assertThat(outboxEventPublished(inventoryDb, orderId, "InventoryReserved")).isTrue()
    }

    @Test
    fun `order is cancelled and payment is compensated when stock is insufficient`() {
        val orderId = createOrder(quantity = 999, amount = "39000")

        val finalStatus = pollUntilTerminal(orderId)

        assertThat(finalStatus).isEqualTo("CANCELLED")
        assertThat(outboxEventPublished(inventoryDb, orderId, "InventoryFailed")).isTrue()
        assertThat(outboxEventPublished(paymentDb, orderId, "PaymentCancelled")).isTrue()
        assertThat(fetchOrder(orderId).get("failureReason").asText()).isEqualTo("insufficient stock")
    }

    private fun createOrder(quantity: Int, amount: String): String {
        val memberId = UUID.randomUUID()
        val body = """
            {"memberId":"$memberId","productId":"$productId","quantity":$quantity,"amount":$amount}
        """.trimIndent()
        val request = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:$orderPort/api/orders"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build()
        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        assertThat(response.statusCode()).isEqualTo(201)
        return objectMapper.readTree(response.body()).get("orderId").asText()
    }

    private fun fetchOrder(orderId: String): JsonNode {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:$orderPort/api/orders/$orderId"))
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

    private fun outboxEventPublished(db: KPostgresContainer, aggregateId: String, eventType: String): Boolean {
        DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { connection ->
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
