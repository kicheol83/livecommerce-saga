package com.livecommerce.order.ws

import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.concurrent.ConcurrentHashMap

@Component
class OrderStatusWebSocketHandler : TextWebSocketHandler() {

    private val sessionsByOrderId = ConcurrentHashMap<String, MutableSet<WebSocketSession>>()

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val orderId = extractOrderId(session) ?: return
        sessionsByOrderId.computeIfAbsent(orderId) { ConcurrentHashMap.newKeySet() }.add(session)
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        sessionsByOrderId.values.forEach { it.remove(session) }
    }

    fun broadcast(orderId: String, payload: String) {
        val sessions = sessionsByOrderId[orderId] ?: return
        sessions.forEach { session ->
            if (session.isOpen) {
                session.sendMessage(TextMessage(payload))
            }
        }
    }

    private fun extractOrderId(session: WebSocketSession): String? {
        val query = session.uri?.query ?: return null
        return query.split("&")
            .map { it.split("=") }
            .firstOrNull { it.size == 2 && it[0] == "orderId" }
            ?.get(1)
    }
}
