package com.livecommerce.inventory.outbox

import com.fasterxml.jackson.databind.ObjectMapper
import io.micrometer.tracing.Tracer
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class OutboxWriter(
    private val outboxEventRepository: OutboxEventRepository,
    private val objectMapper: ObjectMapper,
    private val tracer: Tracer
) {

    fun write(aggregateId: UUID, eventType: String, topic: String, payload: Any) {
        outboxEventRepository.save(
            OutboxEventEntity(
                aggregateId = aggregateId,
                eventType = eventType,
                payload = objectMapper.writeValueAsString(payload),
                topic = topic,
                traceParent = currentTraceParent()
            )
        )
    }

    private fun currentTraceParent(): String? {
        val context = tracer.currentSpan()?.context() ?: return null
        val flags = if (context.sampled() == true) "01" else "00"
        return "00-${context.traceId()}-${context.spanId()}-$flags"
    }
}
