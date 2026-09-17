package com.livecommerce.inventory.outbox

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class OutboxWriter(
    private val outboxEventRepository: OutboxEventRepository,
    private val objectMapper: ObjectMapper
) {

    fun write(aggregateId: UUID, eventType: String, topic: String, payload: Any) {
        outboxEventRepository.save(
            OutboxEventEntity(
                aggregateId = aggregateId,
                eventType = eventType,
                payload = objectMapper.writeValueAsString(payload),
                topic = topic
            )
        )
    }
}
