package com.livecommerce.live.stock

import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.StockChangedEvent
import com.livecommerce.live.config.LiveTopics
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Component

@Component
class StockEventListener(
    private val objectMapper: ObjectMapper,
    private val messagingTemplate: SimpMessagingTemplate
) {

    @KafkaListener(topics = [KafkaTopics.STOCK_EVENTS])
    fun onMessage(record: ConsumerRecord<String, String>) {
        val eventType = record.headers().lastHeader("eventType")?.value()?.let { String(it, Charsets.UTF_8) }
        if (eventType != EventType.STOCK_CHANGED) {
            return
        }
        val event = objectMapper.readValue(record.value(), StockChangedEvent::class.java)
        messagingTemplate.convertAndSend(LiveTopics.STOCK, event)
    }
}
