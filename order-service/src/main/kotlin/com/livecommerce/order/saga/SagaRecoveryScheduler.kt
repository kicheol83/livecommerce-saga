package com.livecommerce.order.saga

import com.livecommerce.order.domain.OrderRepository
import com.livecommerce.order.domain.OrderStatus
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class SagaRecoveryScheduler(
    private val orderRepository: OrderRepository,
    private val orchestrator: OrderSagaOrchestrator,
    @Value("\${saga.step-timeout-seconds:20}") private val stepTimeoutSeconds: Long,
    @Value("\${saga.max-step-retries:3}") private val maxStepRetries: Int
) {

    private val log = LoggerFactory.getLogger(SagaRecoveryScheduler::class.java)

    @Scheduled(fixedDelayString = "\${saga.recovery-interval-ms:5000}")
    fun recoverStuckOrders() {
        val threshold = Instant.now().minusSeconds(stepTimeoutSeconds)
        orderRepository.findTop50ByStatusInAndUpdatedAtBeforeOrderByUpdatedAtAsc(RECOVERABLE_STATUSES, threshold)
            .forEach { order ->
                try {
                    orchestrator.recover(order.id, maxStepRetries)
                } catch (ex: Exception) {
                    log.warn("Saga recovery failed for order {}: {}", order.id, ex.message)
                }
            }
    }

    companion object {
        private val RECOVERABLE_STATUSES = setOf(
            OrderStatus.AWAITING_PAYMENT,
            OrderStatus.AWAITING_INVENTORY,
            OrderStatus.COMPENSATING
        )
    }
}
