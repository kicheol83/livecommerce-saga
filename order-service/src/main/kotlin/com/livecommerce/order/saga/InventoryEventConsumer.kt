package com.livecommerce.order.saga

import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.InventoryFailedEvent
import com.livecommerce.common.events.InventoryReservedEvent
import com.livecommerce.common.events.KafkaTopics
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class InventoryEventConsumer(
    private val orchestrator: OrderSagaOrchestrator,
    private val objectMapper: ObjectMapper
) {

    @KafkaListener(topics = [KafkaTopics.INVENTORY_EVENTS], groupId = "order-service")
    fun onMessage(record: ConsumerRecord<String, String>) {
        val eventType = record.headers().lastHeader("eventType")?.value()?.let { String(it, Charsets.UTF_8) }
        when (eventType) {
            EventType.INVENTORY_RESERVED -> {
                val event = objectMapper.readValue(record.value(), InventoryReservedEvent::class.java)
                orchestrator.onInventoryReserved(event.orderId)
            }
            EventType.INVENTORY_FAILED -> {
                val event = objectMapper.readValue(record.value(), InventoryFailedEvent::class.java)
                orchestrator.onInventoryFailed(event.orderId, event.reason)
            }
        }
    }
}
