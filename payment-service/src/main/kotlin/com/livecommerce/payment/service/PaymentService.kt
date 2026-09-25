package com.livecommerce.payment.service

import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.PaymentCancelledEvent
import com.livecommerce.common.events.PaymentConfirmedEvent
import com.livecommerce.common.events.PaymentFailedEvent
import com.livecommerce.payment.domain.Payment
import com.livecommerce.payment.domain.PaymentRepository
import com.livecommerce.payment.domain.PaymentStatus
import com.livecommerce.payment.gateway.GatewayResult
import com.livecommerce.payment.gateway.PaymentGatewayRouter
import com.livecommerce.payment.outbox.OutboxWriter
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Service
class PaymentService(
    private val paymentRepository: PaymentRepository,
    private val outboxWriter: OutboxWriter,
    private val gateway: PaymentGatewayRouter,
    private val transactionTemplate: TransactionTemplate
) {

    fun confirm(orderId: UUID, memberId: UUID, paymentKey: String, amount: BigDecimal): PaymentStatus {
        paymentRepository.findByOrderId(orderId)?.let { return it.status }
        val result = gateway.confirm(paymentKey, orderId, amount)
        return transactionTemplate.execute<PaymentStatus> {
            paymentRepository.findByOrderId(orderId)?.status ?: record(orderId, memberId, paymentKey, amount, result)
        } ?: PaymentStatus.FAILED
    }

    fun cancel(orderId: UUID, reason: String) {
        val payment = paymentRepository.findByOrderId(orderId)
        if (payment != null && payment.status == PaymentStatus.CONFIRMED && payment.paymentKey != null) {
            gateway.cancel(payment.paymentKey, orderId, reason)
        }
        transactionTemplate.executeWithoutResult {
            val current = paymentRepository.findByOrderId(orderId)
            if (current != null && current.status == PaymentStatus.CONFIRMED) {
                current.markCancelled(Instant.now())
                paymentRepository.save(current)
            }
            outboxWriter.write(
                orderId,
                EventType.PAYMENT_CANCELLED,
                KafkaTopics.PAYMENT_EVENTS,
                PaymentCancelledEvent(orderId, current?.id)
            )
        }
    }

    private fun record(
        orderId: UUID,
        memberId: UUID,
        paymentKey: String,
        amount: BigDecimal,
        result: GatewayResult
    ): PaymentStatus {
        return when (result) {
            is GatewayResult.Approved -> {
                val payment = paymentRepository.save(
                    Payment(
                        id = UUID.randomUUID(),
                        orderId = orderId,
                        memberId = memberId,
                        amount = amount,
                        status = PaymentStatus.CONFIRMED,
                        paymentKey = paymentKey,
                        method = result.method,
                        approvedAt = result.approvedAt
                    )
                )
                outboxWriter.write(
                    orderId,
                    EventType.PAYMENT_CONFIRMED,
                    KafkaTopics.PAYMENT_EVENTS,
                    PaymentConfirmedEvent(orderId, payment.id, amount)
                )
                payment.status
            }
            is GatewayResult.Declined -> {
                val payment = paymentRepository.save(
                    Payment(
                        id = UUID.randomUUID(),
                        orderId = orderId,
                        memberId = memberId,
                        amount = amount,
                        status = PaymentStatus.FAILED,
                        paymentKey = paymentKey,
                        failureCode = result.code,
                        failureMessage = result.message.take(MAX_MESSAGE_LENGTH)
                    )
                )
                outboxWriter.write(
                    orderId,
                    EventType.PAYMENT_FAILED,
                    KafkaTopics.PAYMENT_EVENTS,
                    PaymentFailedEvent(orderId, PAYMENT_DECLINED)
                )
                payment.status
            }
        }
    }

    companion object {
        const val PAYMENT_DECLINED = "payment declined"
        private const val MAX_MESSAGE_LENGTH = 500
    }
}
