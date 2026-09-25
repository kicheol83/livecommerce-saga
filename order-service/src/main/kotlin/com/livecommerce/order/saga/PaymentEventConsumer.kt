package com.livecommerce.order.saga

import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.PaymentCancelledEvent
import com.livecommerce.common.events.PaymentConfirmedEvent
import com.livecommerce.common.events.PaymentFailedEvent
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.kafka.annotation.KafkaListener
import org.springframework.stereotype.Component

@Component
class PaymentEventConsumer(
    private val orchestrator: OrderSagaOrchestrator,
    private val objectMapper: ObjectMapper
) {

    @KafkaListener(topics = [KafkaTopics.PAYMENT_EVENTS], groupId = "order-service")
    fun onMessage(record: ConsumerRecord<String, String>) {
        val eventType = record.headers().lastHeader("eventType")?.value()?.let { String(it, Charsets.UTF_8) }
        when (eventType) {
            EventType.PAYMENT_CONFIRMED -> {
                val event = objectMapper.readValue(record.value(), PaymentConfirmedEvent::class.java)
                orchestrator.onPaymentConfirmed(event.orderId)
            }
            EventType.PAYMENT_FAILED -> {
                val event = objectMapper.readValue(record.value(), PaymentFailedEvent::class.java)
                orchestrator.onPaymentFailed(event.orderId, event.reason)
            }
            EventType.PAYMENT_CANCELLED -> {
                val event = objectMapper.readValue(record.value(), PaymentCancelledEvent::class.java)
                orchestrator.onPaymentCancelled(event.orderId)
            }
        }
    }
}
