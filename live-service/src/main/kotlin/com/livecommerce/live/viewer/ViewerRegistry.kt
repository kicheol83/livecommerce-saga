package com.livecommerce.live.viewer

import com.livecommerce.live.config.LiveTopics
import org.springframework.context.event.EventListener
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.stereotype.Component
import org.springframework.web.socket.messaging.SessionConnectedEvent
import org.springframework.web.socket.messaging.SessionDisconnectEvent
import org.springframework.web.socket.messaging.SessionSubscribeEvent
import java.util.concurrent.ConcurrentHashMap

data class ViewerCountMessage(
    val count: Int
)

@Component
class ViewerRegistry(
    private val messagingTemplate: SimpMessagingTemplate
) {

    private val sessions = ConcurrentHashMap.newKeySet<String>()

    fun count(): Int {
        return sessions.size
    }

    @EventListener
    fun onConnected(event: SessionConnectedEvent) {
        StompHeaderAccessor.wrap(event.message).sessionId?.let { sessions.add(it) }
        broadcast()
    }

    @EventListener
    fun onDisconnect(event: SessionDisconnectEvent) {
        sessions.remove(event.sessionId)
        broadcast()
    }

    @EventListener
    fun onSubscribe(event: SessionSubscribeEvent) {
        if (StompHeaderAccessor.wrap(event.message).destination == LiveTopics.VIEWERS) {
            broadcast()
        }
    }

    private fun broadcast() {
        messagingTemplate.convertAndSend(LiveTopics.VIEWERS, ViewerCountMessage(count()))
    }
}
