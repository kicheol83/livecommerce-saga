package com.livecommerce.integration

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.integration.SagaTestClient.Companion.DEMO_PRODUCT_ID
import com.livecommerce.integration.SagaTestClient.Companion.GATEWAY_URL
import com.livecommerce.integration.SagaTestClient.Companion.USER_ID_HEADER
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID

class AuthFlowTest {

    private val saga = SagaTestClient()
    private val httpClient = HttpClient.newHttpClient()
    private val objectMapper = ObjectMapper()

    @BeforeEach
    fun resetStock() {
        saga.resetStock()
    }

    @Test
    fun `refresh tokens rotate and a reused token revokes the whole session`() {
        val account = newAccount()
        assertThat(signup(account).statusCode()).isEqualTo(201)

        val duplicate = signup(account)
        assertThat(duplicate.statusCode()).isEqualTo(409)
        assertThat(json(duplicate).get("code").asText()).isEqualTo("EMAIL_TAKEN")

        val login = login(account.email, account.password)
        assertThat(login.statusCode()).isEqualTo(200)
        val accessToken = json(login).get("accessToken").asText()
        val originalCookie = refreshCookie(login)

        val me = send(request("/api/auth/me").header("Authorization", "Bearer $accessToken").GET())
        assertThat(me.statusCode()).isEqualTo(200)
        assertThat(json(me).get("nickname").asText()).isEqualTo(account.nickname)

        val rotated = send(request("/api/auth/refresh").header("Cookie", originalCookie).POST(HttpRequest.BodyPublishers.noBody()))
        assertThat(rotated.statusCode()).isEqualTo(200)
        val rotatedCookie = refreshCookie(rotated)
        assertThat(rotatedCookie).isNotEqualTo(originalCookie)

        val reused = send(request("/api/auth/refresh").header("Cookie", originalCookie).POST(HttpRequest.BodyPublishers.noBody()))
        assertThat(reused.statusCode()).isEqualTo(401)
        assertThat(json(reused).get("code").asText()).isEqualTo("REFRESH_TOKEN_REUSED")

        val afterRevocation = send(request("/api/auth/refresh").header("Cookie", rotatedCookie).POST(HttpRequest.BodyPublishers.noBody()))
        assertThat(afterRevocation.statusCode()).isEqualTo(401)
    }

    @Test
    fun `orders require a valid token and are visible only to their owner`() {
        val forged = send(
            request("/api/orders")
                .header("Content-Type", "application/json")
                .header(USER_ID_HEADER, UUID.randomUUID().toString())
                .POST(HttpRequest.BodyPublishers.ofString(orderBody()))
        )
        assertThat(forged.statusCode()).isEqualTo(401)

        val owner = registeredToken()
        val created = send(
            request("/api/orders")
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer $owner")
                .POST(HttpRequest.BodyPublishers.ofString(orderBody()))
        )
        assertThat(created.statusCode()).isEqualTo(201)
        val orderId = json(created).get("orderId").asText()

        val ownView = send(request("/api/orders/$orderId").header("Authorization", "Bearer $owner").GET())
        assertThat(ownView.statusCode()).isEqualTo(200)

        val stranger = registeredToken()
        val strangerView = send(request("/api/orders/$orderId").header("Authorization", "Bearer $stranger").GET())
        assertThat(strangerView.statusCode()).isEqualTo(404)
    }

    @Test
    fun `admin routes are closed to anonymous users and regular users`() {
        assertThat(send(request("/api/admin/ping").GET()).statusCode()).isEqualTo(401)

        val user = registeredToken()
        assertThat(send(request("/api/admin/ping").header("Authorization", "Bearer $user").GET()).statusCode()).isEqualTo(403)

        val admin = json(login(ADMIN_EMAIL, ADMIN_PASSWORD)).get("accessToken").asText()
        assertThat(send(request("/api/admin/ping").header("Authorization", "Bearer $admin").GET()).statusCode()).isEqualTo(404)
    }

    private data class Account(val email: String, val password: String, val nickname: String)

    private fun newAccount(): Account {
        val suffix = UUID.randomUUID().toString().replace("-", "").take(10)
        return Account("user-$suffix@test.local", "password-$suffix", "tester_$suffix")
    }

    private fun registeredToken(): String {
        val account = newAccount()
        val response = signup(account)
        assertThat(response.statusCode()).isEqualTo(201)
        return json(response).get("accessToken").asText()
    }

    private fun signup(account: Account): HttpResponse<String> {
        val body = """{"email":"${account.email}","password":"${account.password}","nickname":"${account.nickname}"}"""
        return send(request("/api/auth/signup").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)))
    }

    private fun login(email: String, password: String): HttpResponse<String> {
        val body = """{"email":"$email","password":"$password"}"""
        return send(request("/api/auth/login").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)))
    }

    private fun orderBody(): String {
        return """{"productId":"$DEMO_PRODUCT_ID","quantity":1,"amount":39000}"""
    }

    private fun refreshCookie(response: HttpResponse<String>): String {
        return response.headers().allValues("set-cookie")
            .first { it.startsWith("$REFRESH_COOKIE=") }
            .substringBefore(";")
    }

    private fun request(path: String): HttpRequest.Builder {
        return HttpRequest.newBuilder().uri(URI.create("$GATEWAY_URL$path"))
    }

    private fun send(builder: HttpRequest.Builder): HttpResponse<String> {
        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    }

    private fun json(response: HttpResponse<String>): JsonNode {
        return objectMapper.readTree(response.body())
    }

    companion object {
        private const val REFRESH_COOKIE = "lc_refresh"
        private const val ADMIN_EMAIL = "admin@livecommerce.local"
        private const val ADMIN_PASSWORD = "admin1234!"
    }
}
