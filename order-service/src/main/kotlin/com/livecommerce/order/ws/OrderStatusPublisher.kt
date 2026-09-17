package com.livecommerce.order.ws

import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.order.domain.Order
import org.springframework.stereotype.Component

data class OrderStatusMessage(
    val orderId: String,
    val status: String,
    val reason: String?
)

@Component
class OrderStatusPublisher(
    private val webSocketHandler: OrderStatusWebSocketHandler,
    private val objectMapper: ObjectMapper
) {

    fun publish(order: Order) {
        val payload = objectMapper.writeValueAsString(
            OrderStatusMessage(order.id.toString(), order.status.name, order.failureReason)
        )
        webSocketHandler.broadcast(order.id.toString(), payload)
    }
}
