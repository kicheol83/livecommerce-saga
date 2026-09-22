package com.livecommerce.inventory.outbox

import com.livecommerce.common.outbox.OutboxStatus
import org.springframework.data.domain.PageRequest
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.KafkaHeaders
import org.springframework.messaging.support.MessageBuilder
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class OutboxRelay(
    private val outboxEventRepository: OutboxEventRepository,
    private val kafkaTemplate: KafkaTemplate<String, String>
) {

    @Scheduled(fixedDelay = 500)
    @Transactional
    fun relay() {
        val pending = outboxEventRepository.findPendingForUpdate(PageRequest.of(0, 50))
        if (pending.isEmpty()) {
            return
        }
        pending.forEach { event ->
            val builder = MessageBuilder
                .withPayload(event.payload)
                .setHeader(KafkaHeaders.TOPIC, event.topic)
                .setHeader(KafkaHeaders.KEY, event.aggregateId.toString())
                .setHeader("eventType", event.eventType)
            event.traceParent?.let { builder.setHeader("traceparent", it) }
            val message = builder.build()
            kafkaTemplate.send(message)
            event.status = OutboxStatus.PUBLISHED
        }
        outboxEventRepository.saveAll(pending)
    }
}
