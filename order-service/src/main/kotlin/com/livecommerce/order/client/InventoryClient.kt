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

@Component
class InventoryClient(
    @Value("\${services.inventory.base-url}") baseUrl: String,
    restClientBuilder: RestClient.Builder
) {
    private val client = restClientBuilder.baseUrl(baseUrl).build()

    fun reserveInventory(request: ReserveInventoryRequest) {
        client.post()
            .uri("/api/inventory/reserve")
            .header("Idempotency-Key", request.orderId.toString())
            .body(request)
            .retrieve()
            .toBodilessEntity()
    }
}
