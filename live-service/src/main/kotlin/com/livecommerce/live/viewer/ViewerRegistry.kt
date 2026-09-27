package com.livecommerce.live.viewer

import com.livecommerce.live.config.LiveTopics
import org.springframework.context.event.EventListener
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.socket.messaging.SessionConnectedEvent
import org.springframework.web.socket.messaging.SessionDisconnectEvent
import org.springframework.web.socket.messaging.SessionSubscribeEvent
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

data class ViewerCountMessage(
    val count: Int
)

@Component
class ViewerRegistry(
    private val messagingTemplate: SimpMessagingTemplate
) {

    private val sessions = ConcurrentHashMap.newKeySet<String>()
    private val lastBroadcastCount = AtomicInteger(-1)
    private val newSubscriberWaiting = AtomicBoolean(false)

    fun count(): Int {
        return sessions.size
    }

    @EventListener
    fun onConnected(event: SessionConnectedEvent) {
        StompHeaderAccessor.wrap(event.message).sessionId?.let { sessions.add(it) }
    }

    @EventListener
    fun onDisconnect(event: SessionDisconnectEvent) {
        sessions.remove(event.sessionId)
    }

    @EventListener
    fun onSubscribe(event: SessionSubscribeEvent) {
        if (StompHeaderAccessor.wrap(event.message).destination == LiveTopics.VIEWERS) {
            newSubscriberWaiting.set(true)
        }
    }

    @Scheduled(fixedDelayString = "\${live.viewer-broadcast-interval-ms:1000}")
    fun broadcastWhenChanged() {
        val current = count()
        val changed = lastBroadcastCount.getAndSet(current) != current
        if (changed || newSubscriberWaiting.getAndSet(false)) {
            messagingTemplate.convertAndSend(LiveTopics.VIEWERS, ViewerCountMessage(current))
        }
    }
}
