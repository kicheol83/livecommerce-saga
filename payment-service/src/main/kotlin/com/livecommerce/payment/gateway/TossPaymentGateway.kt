package com.livecommerce.payment.gateway

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.Base64
import java.util.UUID

@JsonIgnoreProperties(ignoreUnknown = true)
data class TossPaymentResponse(
    val paymentKey: String? = null,
    val status: String? = null,
    val method: String? = null,
    val approvedAt: String? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class TossErrorResponse(
    val code: String? = null,
    val message: String? = null
)

@Component
class TossPaymentGateway(
    properties: TossProperties,
    restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper
) : PaymentGateway {

    private val client = restClientBuilder
        .baseUrl(properties.baseUrl)
        .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + encode(properties.secretKey))
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(CONNECT_TIMEOUT_MS)
                setReadTimeout(READ_TIMEOUT_MS)
            }
        )
        .build()

    override fun confirm(paymentKey: String, orderId: UUID, amount: BigDecimal): GatewayResult {
        val body = mapOf(
            "paymentKey" to paymentKey,
            "orderId" to orderId.toString(),
            "amount" to amount.setScale(0).toLong()
        )
        return try {
            val response = client.post()
                .uri("/v1/payments/confirm")
                .header(IDEMPOTENCY_KEY, "confirm-$orderId")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(TossPaymentResponse::class.java)
            GatewayResult.Approved(response?.method, response?.approvedAt?.let { OffsetDateTime.parse(it).toInstant() })
        } catch (ex: HttpClientErrorException) {
            val error = readError(ex)
            GatewayResult.Declined(error.code ?: ex.statusCode.toString(), error.message ?: "payment declined")
        } catch (ex: RestClientException) {
            throw PaymentGatewayUnavailableException("Toss confirm failed for order $orderId", ex)
        }
    }

    override fun cancel(paymentKey: String, orderId: UUID, reason: String) {
        try {
            client.post()
                .uri("/v1/payments/{paymentKey}/cancel", paymentKey)
                .header(IDEMPOTENCY_KEY, "cancel-$orderId")
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("cancelReason" to reason))
                .retrieve()
                .toBodilessEntity()
        } catch (ex: HttpClientErrorException) {
            if (readError(ex).code == ALREADY_CANCELED) {
                return
            }
            throw PaymentGatewayUnavailableException("Toss rejected cancel for order $orderId", ex)
        } catch (ex: RestClientException) {
            throw PaymentGatewayUnavailableException("Toss cancel failed for order $orderId", ex)
        }
    }

    private fun readError(ex: HttpClientErrorException): TossErrorResponse {
        return try {
            objectMapper.readValue(ex.responseBodyAsString, TossErrorResponse::class.java)
        } catch (parseError: Exception) {
            TossErrorResponse()
        }
    }

    private fun encode(secretKey: String): String {
        return Base64.getEncoder().encodeToString("$secretKey:".toByteArray(Charsets.UTF_8))
    }

    companion object {
        private const val IDEMPOTENCY_KEY = "Idempotency-Key"
        private const val ALREADY_CANCELED = "ALREADY_CANCELED_PAYMENT"
        private const val CONNECT_TIMEOUT_MS = 3000
        private const val READ_TIMEOUT_MS = 30000
    }
}
