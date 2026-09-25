package com.livecommerce.order.client

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.util.UUID

data class ReserveInventoryRequest(
    val orderId: UUID,
    val productId: UUID,
    val quantity: Int
)

data class OrderInventoryRequest(
    val orderId: UUID
)

@Component
class InventoryClient(
    @Value("\${services.inventory.base-url}") baseUrl: String,
    restClientBuilder: RestClient.Builder
) {
    private val client = restClientBuilder
        .baseUrl(baseUrl)
        .requestFactory(timeoutRequestFactory())
        .build()

    fun reserveInventory(request: ReserveInventoryRequest) {
        post("/api/inventory/reserve", request)
    }

    fun confirmInventory(orderId: UUID) {
        post("/api/inventory/confirm", OrderInventoryRequest(orderId))
    }

    fun releaseInventory(orderId: UUID) {
        post("/api/inventory/release", OrderInventoryRequest(orderId))
    }

    private fun post(path: String, body: Any) {
        client.post()
            .uri(path)
            .body(body)
            .retrieve()
            .toBodilessEntity()
    }
}
