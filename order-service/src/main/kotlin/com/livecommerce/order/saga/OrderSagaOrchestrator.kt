package com.livecommerce.order.saga

import com.livecommerce.order.client.CancelPaymentRequest
import com.livecommerce.order.client.InventoryClient
import com.livecommerce.order.client.PaymentClient
import com.livecommerce.order.client.ReleaseInventoryRequest
import com.livecommerce.order.client.ReserveInventoryRequest
import com.livecommerce.order.client.ReservePaymentRequest
import com.livecommerce.order.domain.Order
import com.livecommerce.order.domain.OrderRepository
import com.livecommerce.order.domain.OrderStatus
import com.livecommerce.order.ws.OrderStatusPublisher
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionTemplate
import java.math.BigDecimal
import java.util.UUID

@Component
class OrderSagaOrchestrator(
    private val orderRepository: OrderRepository,
    private val paymentClient: PaymentClient,
    private val inventoryClient: InventoryClient,
    private val statusPublisher: OrderStatusPublisher,
    private val transactionTemplate: TransactionTemplate
) {

    private val log = LoggerFactory.getLogger(OrderSagaOrchestrator::class.java)

    fun createOrder(memberId: UUID, productId: UUID, quantity: Int, amount: BigDecimal): Order {
        val order = orderRepository.save(
            Order(
                id = UUID.randomUUID(),
                memberId = memberId,
                productId = productId,
                quantity = quantity,
                amount = amount,
                status = OrderStatus.AWAITING_PAYMENT
            )
        )
        statusPublisher.publish(order)
        requestPayment(order)
        return order
    }

    fun onPaymentReserved(orderId: UUID) {
        val advanced = transition(orderId, setOf(OrderStatus.AWAITING_PAYMENT)) {
            it.markPaymentConfirmed()
            it.markAwaitingInventory()
        }
        if (advanced != null) {
            statusPublisher.publish(advanced)
            requestInventory(advanced)
            return
        }
        if (currentStatus(orderId) == OrderStatus.CANCELLED) {
            paymentClient.cancelPayment(CancelPaymentRequest(orderId))
        }
    }

    fun onPaymentFailed(orderId: UUID, reason: String) {
        transition(orderId, setOf(OrderStatus.AWAITING_PAYMENT)) { it.markCancelled(reason) }
            ?.let { statusPublisher.publish(it) }
    }

    fun onInventoryReserved(orderId: UUID) {
        val completed = transition(orderId, setOf(OrderStatus.AWAITING_INVENTORY)) { it.markCompleted() }
        if (completed != null) {
            statusPublisher.publish(completed)
            return
        }
        val status = currentStatus(orderId) ?: return
        if (status in RELEASABLE_STATUSES) {
            inventoryClient.releaseInventory(ReleaseInventoryRequest(orderId))
        }
    }

    fun onInventoryFailed(orderId: UUID, reason: String) {
        val compensating = transition(orderId, setOf(OrderStatus.AWAITING_INVENTORY)) {
            it.markCompensating(reason)
        } ?: return
        statusPublisher.publish(compensating)
        requestPaymentCancellation(compensating)
    }

    fun onPaymentCancelled(orderId: UUID) {
        transition(orderId, setOf(OrderStatus.COMPENSATING)) {
            it.markCancelled(it.failureReason ?: COMPENSATED_REASON)
        }?.let { statusPublisher.publish(it) }
    }

    fun recover(orderId: UUID, maxRetries: Int) {
        val order = orderRepository.findById(orderId).orElse(null) ?: return
        when {
            order.status == OrderStatus.COMPENSATING -> retryStep(order.id, OrderStatus.COMPENSATING)
            order.retryCount < maxRetries -> retryStep(order.id, order.status)
            order.status == OrderStatus.AWAITING_PAYMENT -> timeOutPayment(order.id)
            order.status == OrderStatus.AWAITING_INVENTORY -> timeOutInventory(order.id)
        }
    }

    private fun retryStep(orderId: UUID, expected: OrderStatus) {
        val retried = transition(orderId, setOf(expected)) { it.recordRetry() } ?: return
        log.info("Retrying saga step {} for order {} (retry {})", expected, orderId, retried.retryCount)
        when (expected) {
            OrderStatus.AWAITING_PAYMENT -> requestPayment(retried)
            OrderStatus.AWAITING_INVENTORY -> requestInventory(retried)
            OrderStatus.COMPENSATING -> requestPaymentCancellation(retried)
            else -> Unit
        }
    }

    private fun timeOutPayment(orderId: UUID) {
        val cancelled = transition(orderId, setOf(OrderStatus.AWAITING_PAYMENT)) {
            it.markCancelled(PAYMENT_TIMEOUT_REASON)
        } ?: return
        statusPublisher.publish(cancelled)
        requestPaymentCancellation(cancelled)
    }

    private fun timeOutInventory(orderId: UUID) {
        val compensating = transition(orderId, setOf(OrderStatus.AWAITING_INVENTORY)) {
            it.markCompensating(INVENTORY_TIMEOUT_REASON)
        } ?: return
        statusPublisher.publish(compensating)
        requestInventoryRelease(compensating)
        requestPaymentCancellation(compensating)
    }

    private fun requestPayment(order: Order) {
        attempt("reserve payment", order.id) {
            paymentClient.reservePayment(ReservePaymentRequest(order.id, order.memberId, order.amount))
        }
    }

    private fun requestInventory(order: Order) {
        attempt("reserve inventory", order.id) {
            inventoryClient.reserveInventory(ReserveInventoryRequest(order.id, order.productId, order.quantity))
        }
    }

    private fun requestPaymentCancellation(order: Order) {
        attempt("cancel payment", order.id) {
            paymentClient.cancelPayment(CancelPaymentRequest(order.id))
        }
    }

    private fun requestInventoryRelease(order: Order) {
        attempt("release inventory", order.id) {
            inventoryClient.releaseInventory(ReleaseInventoryRequest(order.id))
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
        private val RELEASABLE_STATUSES = setOf(OrderStatus.COMPENSATING, OrderStatus.CANCELLED)
        private const val COMPENSATED_REASON = "compensated"
        private const val PAYMENT_TIMEOUT_REASON = "payment step timed out"
        private const val INVENTORY_TIMEOUT_REASON = "inventory step timed out"
    }
}
