package com.livecommerce.order.saga

import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.OrderCompletedEvent
import com.livecommerce.common.shipping.ShippingAddress
import com.livecommerce.order.client.CancelPaymentRequest
import com.livecommerce.order.client.ConfirmPaymentRequest
import com.livecommerce.order.client.InventoryClient
import com.livecommerce.order.client.PaymentClient
import com.livecommerce.order.client.ReserveInventoryRequest
import com.livecommerce.order.domain.Order
import com.livecommerce.order.domain.OrderRepository
import com.livecommerce.order.domain.OrderStatus
import com.livecommerce.order.outbox.OutboxWriter
import com.livecommerce.order.ws.OrderStatusPublisher
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.util.UUID

@Component
class OrderSagaOrchestrator(
    private val orderRepository: OrderRepository,
    private val paymentClient: PaymentClient,
    private val inventoryClient: InventoryClient,
    private val statusPublisher: OrderStatusPublisher,
    private val transactionTemplate: TransactionTemplate,
    private val outboxWriter: OutboxWriter,
    @Value("\${saga.payment-window-seconds:300}") paymentWindowSeconds: Long
) {

    private val log = LoggerFactory.getLogger(OrderSagaOrchestrator::class.java)
    private val paymentWindow: Duration = Duration.ofSeconds(paymentWindowSeconds)

    fun createOrder(memberId: UUID, productId: UUID, quantity: Int, shipping: ShippingAddress): Order {
        val order = orderRepository.save(
            Order(
                id = UUID.randomUUID(),
                memberId = memberId,
                productId = productId,
                quantity = quantity,
                status = OrderStatus.AWAITING_STOCK,
                recipientName = shipping.recipientName,
                recipientPhone = shipping.phone,
                zipCode = shipping.zipCode,
                addressLine1 = shipping.address1,
                addressLine2 = shipping.address2
            )
        )
        statusPublisher.publish(order)
        requestStockHold(order)
        return order
    }

    fun onStockHeld(orderId: UUID, unitPrice: BigDecimal, holdExpiresAt: Instant) {
        val payable = transition(orderId, setOf(OrderStatus.AWAITING_STOCK)) {
            it.markAwaitingPayment(unitPrice.multiply(BigDecimal(it.quantity)), paymentDeadline(holdExpiresAt))
        }
        if (payable != null) {
            statusPublisher.publish(payable)
            return
        }
        if (currentStatus(orderId) == OrderStatus.CANCELLED) {
            inventoryClient.releaseInventory(orderId)
        }
    }

    fun onStockUnavailable(orderId: UUID, reason: String) {
        transition(orderId, setOf(OrderStatus.AWAITING_STOCK)) { it.markCancelled(reason) }
            ?.let { statusPublisher.publish(it) }
    }

    fun submitPayment(orderId: UUID, memberId: UUID, paymentKey: String, amount: BigDecimal): PaymentSubmission {
        val order = orderRepository.findById(orderId).orElse(null)
        if (order == null || order.memberId != memberId) {
            return PaymentSubmission.NotFound
        }
        if (order.status == OrderStatus.PAYMENT_CONFIRMING && order.paymentKey == paymentKey) {
            return PaymentSubmission.Accepted(order)
        }
        if (order.status != OrderStatus.AWAITING_PAYMENT) {
            return PaymentSubmission.NotPayable
        }
        val expected = order.amount
        if (expected == null || expected.compareTo(amount) != 0) {
            return PaymentSubmission.AmountMismatch
        }
        if (!order.isPaymentWindowOpen(Instant.now())) {
            return PaymentSubmission.WindowExpired
        }
        val confirming = transition(orderId, setOf(OrderStatus.AWAITING_PAYMENT)) {
            it.markPaymentConfirming(paymentKey)
        } ?: return PaymentSubmission.NotPayable
        statusPublisher.publish(confirming)
        requestPaymentConfirmation(confirming)
        return PaymentSubmission.Accepted(confirming)
    }

    fun cancelByBuyer(orderId: UUID, memberId: UUID): BuyerCancellation {
        val order = orderRepository.findById(orderId).orElse(null)
        if (order == null || order.memberId != memberId) {
            return BuyerCancellation.NotFound
        }
        val cancelled = transition(orderId, BUYER_CANCELLABLE) { it.markCancelled(CANCELLED_BY_BUYER) }
            ?: return BuyerCancellation.NotCancellable
        statusPublisher.publish(cancelled)
        requestStockRelease(cancelled)
        return BuyerCancellation.Cancelled(cancelled)
    }

    fun cancelByAdmin(orderId: UUID): AdminIntervention {
        if (!orderRepository.existsById(orderId)) {
            return AdminIntervention.NotFound
        }
        val cancelled = transition(orderId, BUYER_CANCELLABLE) { it.markCancelled(CANCELLED_BY_ADMIN) }
            ?: return AdminIntervention.NotApplicable
        statusPublisher.publish(cancelled)
        requestStockRelease(cancelled)
        return AdminIntervention.Applied(cancelled)
    }

    fun retryNow(orderId: UUID): AdminIntervention {
        val order = orderRepository.findById(orderId).orElse(null) ?: return AdminIntervention.NotFound
        if (order.status !in RETRYABLE) {
            return AdminIntervention.NotApplicable
        }
        retryStep(orderId, order.status)
        val refreshed = orderRepository.findById(orderId).orElse(null) ?: return AdminIntervention.NotFound
        return AdminIntervention.Applied(refreshed)
    }

    fun onPaymentConfirmed(orderId: UUID) {
        val confirmingStock = transition(orderId, setOf(OrderStatus.PAYMENT_CONFIRMING)) { it.markConfirmingStock() }
        if (confirmingStock != null) {
            statusPublisher.publish(confirmingStock)
            requestStockConfirmation(confirmingStock)
            return
        }
        if (currentStatus(orderId) == OrderStatus.CANCELLED) {
            paymentClient.cancelPayment(CancelPaymentRequest(orderId, LATE_PAYMENT_REFUND))
        }
    }

    fun onPaymentFailed(orderId: UUID, reason: String) {
        val cancelled = transition(orderId, setOf(OrderStatus.PAYMENT_CONFIRMING)) { it.markCancelled(reason) } ?: return
        statusPublisher.publish(cancelled)
        requestStockRelease(cancelled)
    }

    fun onStockConfirmed(orderId: UUID) {
        transition(orderId, setOf(OrderStatus.CONFIRMING_STOCK)) {
            it.markCompleted()
            publishCompletion(it)
        }?.let { statusPublisher.publish(it) }
    }

    private fun publishCompletion(order: Order) {
        val shipping = order.shippingAddress() ?: return
        val amount = order.amount ?: return
        outboxWriter.write(
            order.id,
            EventType.ORDER_COMPLETED,
            KafkaTopics.ORDER_EVENTS,
            OrderCompletedEvent(order.id, order.memberId, order.productId, order.quantity, amount, shipping, order.updatedAt)
        )
    }

    fun onStockConfirmationFailed(orderId: UUID, reason: String) {
        val compensating = transition(orderId, setOf(OrderStatus.CONFIRMING_STOCK)) { it.markCompensating(reason) } ?: return
        statusPublisher.publish(compensating)
        requestPaymentCancellation(compensating)
    }

    fun onPaymentCancelled(orderId: UUID) {
        transition(orderId, setOf(OrderStatus.COMPENSATING)) {
            it.markCancelled(it.failureReason ?: COMPENSATED)
        }?.let { statusPublisher.publish(it) }
    }

    fun recover(orderId: UUID, maxRetries: Int) {
        val order = orderRepository.findById(orderId).orElse(null) ?: return
        when (order.status) {
            OrderStatus.AWAITING_STOCK ->
                if (order.retryCount < maxRetries) retryStep(orderId, OrderStatus.AWAITING_STOCK) else timeOutStockHold(orderId)
            OrderStatus.AWAITING_PAYMENT ->
                if (!order.isPaymentWindowOpen(Instant.now())) expirePaymentWindow(orderId)
            OrderStatus.PAYMENT_CONFIRMING,
            OrderStatus.CONFIRMING_STOCK,
            OrderStatus.COMPENSATING -> retryStep(orderId, order.status)
            OrderStatus.COMPLETED,
            OrderStatus.CANCELLED -> Unit
        }
    }

    private fun retryStep(orderId: UUID, expected: OrderStatus) {
        val retried = transition(orderId, setOf(expected)) { it.recordRetry() } ?: return
        log.info("Retrying saga step {} for order {} (retry {})", expected, orderId, retried.retryCount)
        when (expected) {
            OrderStatus.AWAITING_STOCK -> requestStockHold(retried)
            OrderStatus.PAYMENT_CONFIRMING -> requestPaymentConfirmation(retried)
            OrderStatus.CONFIRMING_STOCK -> requestStockConfirmation(retried)
            OrderStatus.COMPENSATING -> requestPaymentCancellation(retried)
            else -> Unit
        }
    }

    private fun timeOutStockHold(orderId: UUID) {
        val cancelled = transition(orderId, setOf(OrderStatus.AWAITING_STOCK)) {
            it.markCancelled(INVENTORY_TIMEOUT)
        } ?: return
        statusPublisher.publish(cancelled)
        requestStockRelease(cancelled)
    }

    private fun expirePaymentWindow(orderId: UUID) {
        val cancelled = transition(orderId, setOf(OrderStatus.AWAITING_PAYMENT)) {
            it.markCancelled(PAYMENT_WINDOW_EXPIRED)
        } ?: return
        statusPublisher.publish(cancelled)
        requestStockRelease(cancelled)
    }

    private fun paymentDeadline(holdExpiresAt: Instant): Instant {
        val windowEnd = Instant.now().plus(paymentWindow)
        val holdSafeEnd = holdExpiresAt.minus(HOLD_SAFETY_MARGIN)
        return if (holdSafeEnd.isBefore(windowEnd)) holdSafeEnd else windowEnd
    }

    private fun requestStockHold(order: Order) {
        attempt("hold stock", order.id) {
            inventoryClient.reserveInventory(ReserveInventoryRequest(order.id, order.productId, order.quantity))
        }
    }

    private fun requestStockConfirmation(order: Order) {
        attempt("confirm stock", order.id) { inventoryClient.confirmInventory(order.id) }
    }

    private fun requestStockRelease(order: Order) {
        attempt("release stock", order.id) { inventoryClient.releaseInventory(order.id) }
    }

    private fun requestPaymentConfirmation(order: Order) {
        val paymentKey = order.paymentKey ?: return
        val amount = order.amount ?: return
        attempt("confirm payment", order.id) {
            paymentClient.confirmPayment(ConfirmPaymentRequest(order.id, order.memberId, paymentKey, amount))
        }
    }

    private fun requestPaymentCancellation(order: Order) {
        attempt("cancel payment", order.id) {
            paymentClient.cancelPayment(CancelPaymentRequest(order.id, order.failureReason ?: COMPENSATED))
        }
    }

    private fun attempt(action: String, orderId: UUID, call: () -> Unit) {
        try {
            call()
        } catch (ex: Exception) {
            log.warn("Could not {} for order {}, saga recovery will retry: {}", action, orderId, ex.message)
        }
    }

    private fun currentStatus(orderId: UUID): OrderStatus? {
        return orderRepository.findById(orderId).map { it.status }.orElse(null)
    }

    private fun transition(orderId: UUID, expected: Set<OrderStatus>, mutation: (Order) -> Unit): Order? {
        return transactionTemplate.execute<Order?> {
            val order = orderRepository.findById(orderId).orElse(null)
            if (order == null || order.status !in expected) {
                null
            } else {
                mutation(order)
                orderRepository.save(order)
            }
        }
    }

    companion object {
        const val PAYMENT_WINDOW_EXPIRED = "payment window expired"
        const val INVENTORY_TIMEOUT = "inventory step timed out"
        const val CANCELLED_BY_BUYER = "cancelled by buyer"
        const val CANCELLED_BY_ADMIN = "cancelled by admin"
        private const val COMPENSATED = "compensated"
        private const val LATE_PAYMENT_REFUND = "payment arrived after the order was cancelled"
        private val HOLD_SAFETY_MARGIN: Duration = Duration.ofSeconds(60)
        private val BUYER_CANCELLABLE = setOf(OrderStatus.AWAITING_STOCK, OrderStatus.AWAITING_PAYMENT)
        private val RETRYABLE = setOf(
            OrderStatus.AWAITING_STOCK,
            OrderStatus.PAYMENT_CONFIRMING,
            OrderStatus.CONFIRMING_STOCK,
            OrderStatus.COMPENSATING
        )
    }
}
