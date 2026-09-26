package com.livecommerce.live.client

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.math.BigDecimal
import java.util.UUID

data class ProductStockResponse(
    val productId: UUID,
    val quantityAvailable: Int,
    val unitPrice: BigDecimal? = null
)

@Component
class InventoryClient(
    @Value("\${services.inventory.base-url}") baseUrl: String,
    restClientBuilder: RestClient.Builder
) {

    private val log = LoggerFactory.getLogger(InventoryClient::class.java)

    private val client = restClientBuilder
        .baseUrl(baseUrl)
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(CONNECT_TIMEOUT_MS)
                setReadTimeout(READ_TIMEOUT_MS)
            }
        )
        .build()

    fun findProduct(productId: UUID): ProductStockResponse? {
        return try {
            client.get()
                .uri("/api/inventory/products/{productId}", productId)
                .retrieve()
                .body(ProductStockResponse::class.java)
        } catch (ex: Exception) {
            log.warn("Could not load stock for product {}: {}", productId, ex.message)
            null
        }
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 2000
        private const val READ_TIMEOUT_MS = 3000
    }
}
