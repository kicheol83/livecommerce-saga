package com.livecommerce.order.outbox

import com.livecommerce.common.outbox.OutboxStatus
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.kafka.support.SendResult
import org.springframework.kafka.support.KafkaHeaders
import org.springframework.messaging.Message
import org.springframework.messaging.support.MessageBuilder
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

@Component
class OutboxRelay(
    private val outboxEventRepository: OutboxEventRepository,
    private val kafkaTemplate: KafkaTemplate<String, String>
) {

    private val log = LoggerFactory.getLogger(OutboxRelay::class.java)

    @Scheduled(fixedDelayString = "\${outbox.poll-interval-ms:100}")
    @Transactional
    fun relay() {
        val pending = outboxEventRepository.findPendingForUpdate(PageRequest.of(0, BATCH_SIZE))
        val inFlight = mutableListOf<Pair<OutboxEventEntity, CompletableFuture<SendResult<String, String>>>>()
        for (event in pending) {
            try {
                inFlight += event to kafkaTemplate.send(toMessage(event))
            } catch (ex: Exception) {
                recordFailure(event, ex)
                break
            }
        }
        for ((event, send) in inFlight) {
            try {
                send.get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                event.status = OutboxStatus.PUBLISHED
            } catch (ex: Exception) {
                recordFailure(event, ex)
                break
            }
        }
    }

    private fun recordFailure(event: OutboxEventEntity, ex: Exception) {
        if (ex is InterruptedException) {
            Thread.currentThread().interrupt()
        }
        event.attempts += 1
        event.lastError = (ex.message ?: ex.javaClass.simpleName).take(MAX_ERROR_LENGTH)
        log.warn("Outbox event {} not delivered (attempt {}): {}", event.id, event.attempts, event.lastError)
    }

    private fun toMessage(event: OutboxEventEntity): Message<String> {
        val builder = MessageBuilder
            .withPayload(event.payload)
            .setHeader(KafkaHeaders.TOPIC, event.topic)
            .setHeader(KafkaHeaders.KEY, event.aggregateId.toString())
            .setHeader("eventType", event.eventType)
        event.traceParent?.let { builder.setHeader("traceparent", it) }
        return builder.build()
    }

    companion object {
        private const val BATCH_SIZE = 100
        private const val SEND_TIMEOUT_SECONDS = 15L
        private const val MAX_ERROR_LENGTH = 500
    }
}
