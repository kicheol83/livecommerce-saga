package com.livecommerce.integration

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.sql.Connection
import java.sql.DriverManager
import java.sql.PreparedStatement
import java.time.Duration
import java.util.UUID
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

enum class Database(
    private val port: Int,
    private val databaseName: String,
    private val username: String,
    private val password: String
) {
    ORDER(5455, "order_db", "order_user", "order_pass"),
    PAYMENT(5456, "payment_db", "payment_user", "payment_pass"),
    INVENTORY(5457, "inventory_db", "inventory_user", "inventory_pass");

    fun connect(): Connection {
        return DriverManager.getConnection("jdbc:postgresql://localhost:$port/$databaseName", username, password)
    }
}

class SagaTestClient {

    private val httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(CONNECT_TIMEOUT_SECONDS)).build()
    private val objectMapper = ObjectMapper()

    fun createOrder(quantity: Int): String {
        val body = """
            {"productId":"$DEMO_PRODUCT_ID","quantity":$quantity}
        """.trimIndent()
        val response = send(
            HttpRequest.newBuilder()
                .uri(URI.create("$ORDER_SERVICE_URL/api/orders"))
                .header("Content-Type", "application/json")
                .header(USER_ID_HEADER, TEST_USER_ID)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build()
        )
        assertThat(response.statusCode()).isEqualTo(201)
        return objectMapper.readTree(response.body()).get("orderId").asText()
    }

    fun fetchOrder(orderId: String): JsonNode {
        val response = send(
            HttpRequest.newBuilder()
                .uri(URI.create("$ORDER_SERVICE_URL/api/orders/$orderId"))
                .header(USER_ID_HEADER, TEST_USER_ID)
                .GET()
                .build()
        )
        return objectMapper.readTree(response.body())
    }

    fun getJson(url: String): JsonNode {
        val response = send(HttpRequest.newBuilder().uri(URI.create(url)).GET().build())
        assertThat(response.statusCode()).isEqualTo(200)
        return objectMapper.readTree(response.body())
    }

    fun submitPayment(orderId: String, paymentKey: String, amount: String? = null): Int {
        val paidAmount = amount ?: fetchOrder(orderId).get("amount").decimalValue().toPlainString()
        val body = """{"paymentKey":"$paymentKey","amount":$paidAmount}"""
        return send(
            HttpRequest.newBuilder()
                .uri(URI.create("$ORDER_SERVICE_URL/api/orders/$orderId/payment"))
                .header("Content-Type", "application/json")
                .header(USER_ID_HEADER, TEST_USER_ID)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build()
        ).statusCode()
    }

    fun cancelOrder(orderId: String): Int {
        return send(
            HttpRequest.newBuilder()
                .uri(URI.create("$ORDER_SERVICE_URL/api/orders/$orderId/cancel"))
                .header(USER_ID_HEADER, TEST_USER_ID)
                .POST(HttpRequest.BodyPublishers.noBody())
                .build()
        ).statusCode()
    }

    fun awaitPayable(orderId: String): String {
        return pollUntilStatus(orderId, PAYABLE_OR_TERMINAL, Duration.ofSeconds(20))
    }

    fun approvalKey(): String {
        return "fake_approve_${UUID.randomUUID()}"
    }

    fun declineKey(): String {
        return "fake_decline_${UUID.randomUUID()}"
    }

    fun paymentCount(orderId: String): Int {
        return queryInt(Database.PAYMENT, "select count(*) from payments where order_id = ?", UUID.fromString(orderId))
    }

    fun awaitStock(expected: Int): Boolean {
        return waitUntil(Duration.ofSeconds(15)) { stock() == expected }
    }

    fun orderStatus(orderId: String): String {
        return fetchOrder(orderId).get("status").asText()
    }

    fun pollUntilStatus(orderId: String, expected: Set<String>, timeout: Duration): String {
        var lastStatus = orderStatus(orderId)
        waitUntil(timeout) {
            lastStatus = orderStatus(orderId)
            lastStatus in expected
        }
        return lastStatus
    }

    fun post(url: String, body: String): Int {
        return send(
            HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build()
        ).statusCode()
    }

    fun outboxStatus(database: Database, aggregateId: String, eventType: String): String? {
        return queryString(
            database,
            "select status from outbox_events where aggregate_id = ? and event_type = ?",
            UUID.fromString(aggregateId),
            eventType
        )
    }

    fun outboxAttempts(database: Database, aggregateId: String, eventType: String): Int {
        return queryInt(
            database,
            "select coalesce(max(attempts), 0) from outbox_events where aggregate_id = ? and event_type = ?",
            UUID.fromString(aggregateId),
            eventType
        )
    }

    fun awaitOutboxPublished(database: Database, aggregateId: String, eventType: String): Boolean {
        return waitUntil(Duration.ofSeconds(15)) {
            outboxStatus(database, aggregateId, eventType) == "PUBLISHED"
        }
    }

    fun stock(): Int {
        return queryInt(
            Database.INVENTORY,
            "select quantity_available from product_stock where product_id = ?",
            DEMO_PRODUCT_ID
        )
    }

    fun resetStock(quantity: Int = DEMO_STOCK) {
        Database.INVENTORY.connect().use { connection ->
            connection.prepareStatement(
                "update product_stock set quantity_available = ? where product_id = ?"
            ).use { statement ->
                bind(statement, arrayOf(quantity, DEMO_PRODUCT_ID))
                statement.executeUpdate()
            }
        }
    }

    fun queryInt(database: Database, sql: String, vararg params: Any): Int {
        database.connect().use { connection ->
            connection.prepareStatement(sql).use { statement ->
                bind(statement, params)
                statement.executeQuery().use { resultSet ->
                    resultSet.next()
                    return resultSet.getInt(1)
                }
            }
        }
    }

    fun docker(vararg args: String) {
        val exitCode = ProcessBuilder(listOf("docker") + args).inheritIO().start().waitFor()
        check(exitCode == 0) { "docker ${args.joinToString(" ")} exited with code $exitCode" }
    }

    fun awaitDatabase(database: Database) {
        val available = waitUntil(Duration.ofSeconds(60)) {
            try {
                database.connect().use { it.isValid(2) }
            } catch (ex: Exception) {
                false
            }
        }
        check(available) { "$database did not become available" }
    }

    fun waitUntil(timeout: Duration, condition: () -> Boolean): Boolean {
        val deadline = System.nanoTime() + timeout.toNanos()
        while (System.nanoTime() < deadline) {
            if (condition()) {
                return true
            }
            Thread.sleep(POLL_INTERVAL_MS)
        }
        return condition()
    }

    private fun queryString(database: Database, sql: String, vararg params: Any): String? {
        database.connect().use { connection ->
            connection.prepareStatement(sql).use { statement ->
                bind(statement, params)
                statement.executeQuery().use { resultSet ->
                    return if (resultSet.next()) resultSet.getString(1) else null
                }
            }
        }
    }

    private fun bind(statement: PreparedStatement, params: Array<out Any>) {
        params.forEachIndexed { index, value -> statement.setObject(index + 1, value) }
    }

    private fun send(request: HttpRequest): HttpResponse<String> {
        return sendWithTimeout(httpClient, request)
    }

    companion object {
        const val ORDER_SERVICE_URL = "http://localhost:8081"
        const val PAYMENT_SERVICE_URL = "http://localhost:8082"
        const val INVENTORY_SERVICE_URL = "http://localhost:8083"
        const val LIVE_SERVICE_URL = "http://localhost:8084"
        const val GATEWAY_URL = "http://localhost:8080"
        const val USER_ID_HEADER = "X-User-Id"
        val TEST_USER_ID: String = UUID.randomUUID().toString()
        const val DEMO_STOCK = 100
        val DEMO_PRODUCT_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val TERMINAL_STATUSES = setOf("COMPLETED", "CANCELLED")
        val PAYABLE_OR_TERMINAL = setOf("AWAITING_PAYMENT", "COMPLETED", "CANCELLED")
        private const val POLL_INTERVAL_MS = 500L
        private const val CONNECT_TIMEOUT_SECONDS = 5L
    }
}

private const val RESPONSE_TIMEOUT_SECONDS = 20L

fun sendWithTimeout(client: HttpClient, request: HttpRequest): HttpResponse<String> {
    return try {
        client.sendAsync(request, HttpResponse.BodyHandlers.ofString()).get(RESPONSE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    } catch (ex: TimeoutException) {
        throw AssertionError("No response within ${RESPONSE_TIMEOUT_SECONDS}s from ${request.method()} ${request.uri()}", ex)
    } catch (ex: ExecutionException) {
        throw AssertionError("Request failed: ${request.method()} ${request.uri()}: ${ex.cause?.message}", ex.cause ?: ex)
    }
}
