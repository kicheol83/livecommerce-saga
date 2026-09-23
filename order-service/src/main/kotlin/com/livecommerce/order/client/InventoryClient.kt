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

data class ReleaseInventoryRequest(
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
        client.post()
            .uri("/api/inventory/reserve")
            .header("Idempotency-Key", request.orderId.toString())
            .body(request)
            .retrieve()
            .toBodilessEntity()
    }

    fun releaseInventory(request: ReleaseInventoryRequest) {
        client.post()
            .uri("/api/inventory/release")
            .header("Idempotency-Key", request.orderId.toString())
            .body(request)
            .retrieve()
            .toBodilessEntity()
    }
}
