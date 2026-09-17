package com.livecommerce.payment.service

import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.PaymentCancelledEvent
import com.livecommerce.common.events.PaymentFailedEvent
import com.livecommerce.common.events.PaymentReservedEvent
import com.livecommerce.payment.domain.Payment
import com.livecommerce.payment.domain.PaymentRepository
import com.livecommerce.payment.domain.PaymentStatus
import com.livecommerce.payment.outbox.OutboxWriter
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID

@Service
class PaymentService(
    private val paymentRepository: PaymentRepository,
    private val outboxWriter: OutboxWriter
) {

    @Transactional
    fun reserve(orderId: UUID, memberId: UUID, amount: BigDecimal) {
        val existing = paymentRepository.findByOrderId(orderId)
        if (existing != null) {
            return
        }
        if (amount > SINGLE_PAYMENT_LIMIT) {
            outboxWriter.write(
                orderId,
                EventType.PAYMENT_FAILED,
                KafkaTopics.PAYMENT_EVENTS,
                PaymentFailedEvent(orderId, "amount exceeds single payment limit")
            )
            return
        }
        val payment = Payment(
            id = UUID.randomUUID(),
            orderId = orderId,
            memberId = memberId,
            amount = amount,
            status = PaymentStatus.RESERVED
        )
        paymentRepository.save(payment)
        outboxWriter.write(
            orderId,
            EventType.PAYMENT_RESERVED,
            KafkaTopics.PAYMENT_EVENTS,
            PaymentReservedEvent(orderId, payment.id, payment.amount)
        )
    }

    @Transactional
    fun cancel(orderId: UUID) {
        val payment = paymentRepository.findByOrderId(orderId) ?: return
        if (payment.status == PaymentStatus.CANCELLED) {
            return
        }
        payment.status = PaymentStatus.CANCELLED
        paymentRepository.save(payment)
        outboxWriter.write(
            orderId,
            EventType.PAYMENT_CANCELLED,
            KafkaTopics.PAYMENT_EVENTS,
            PaymentCancelledEvent(orderId, payment.id)
        )
    }

    companion object {
        private val SINGLE_PAYMENT_LIMIT = BigDecimal("5000000")
    }
}
