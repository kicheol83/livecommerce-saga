package com.livecommerce.live.session

import com.livecommerce.live.api.dto.LiveSessionResponse
import com.livecommerce.live.client.InventoryClient
import com.livecommerce.live.viewer.ViewerRegistry
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant

@Service
class LiveSessionService(
    private val properties: LiveSessionProperties,
    private val inventoryClient: InventoryClient,
    private val viewerRegistry: ViewerRegistry
) {

    private val startedAt = Instant.now()

    fun currentSession(): LiveSessionResponse {
        val product = inventoryClient.findProduct(properties.productId)
        return LiveSessionResponse(
            sessionId = properties.id,
            title = properties.title,
            hostName = properties.hostName,
            productId = properties.productId,
            productName = properties.productName,
            price = product?.unitPrice ?: properties.price,
            originalPrice = properties.originalPrice,
            stock = product?.quantityAvailable,
            endsAt = currentWindowEnd(),
            viewerCount = viewerRegistry.count()
        )
    }

    private fun currentWindowEnd(): Instant {
        val window = Duration.ofMinutes(properties.durationMinutes)
        val elapsedMillis = Duration.between(startedAt, Instant.now()).toMillis()
        val completedWindows = elapsedMillis / window.toMillis()
        return startedAt.plus(window.multipliedBy(completedWindows + 1))
    }
}
