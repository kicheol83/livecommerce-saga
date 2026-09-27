package com.livecommerce.delivery.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.OrderCompletedEvent
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class OrderEventConsumer(
    private val deliveryService: DeliveryService,
    private val objectMapper: ObjectMapper
) {

    @KafkaListener(topics = [KafkaTopics.ORDER_EVENTS])
    fun onMessage(record: ConsumerRecord<String, String>) {
        val eventType = record.headers().lastHeader("eventType")?.value()?.let { String(it, Charsets.UTF_8) }
        if (eventType != EventType.ORDER_COMPLETED) {
            return
        }
        deliveryService.register(objectMapper.readValue(record.value(), OrderCompletedEvent::class.java))
    }
}
